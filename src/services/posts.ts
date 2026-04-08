import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { PublicProfile } from "@/services/social";
import { compressImageFile } from "@/lib/compressImage";

type PgErr = { code?: string; message?: string };

/** Maps missing-column / stale schema cache errors to an actionable message. */
function friendlyPostsWriteError(error: PgErr): Error {
  const msg = error.message ?? "";
  if (
    error.code === "PGRST204" ||
    msg.includes("schema cache") ||
    (msg.includes("Could not find the ") && msg.includes("posts") && msg.includes("column"))
  ) {
    return new Error(
      "Post settings need a quick database update. In Supabase: SQL Editor → open and run supabase/manual_apply_post_flags.sql from this project, then wait a few seconds and try again."
    );
  }
  return new Error(msg || "Update failed");
}

export type PostRow = Tables<"posts">;

export type PostWithMeta = PostRow & {
  profile: PublicProfile | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  taggedUsers: PublicProfile[];
};

export type PostCommentWithProfile = Tables<"post_comments"> & { profile: PublicProfile | null };

const FEED_PAGE = 10;

/** Works before/after `archived` column exists (missing column → undefined → visible). */
function isPostVisibleInFeedAndProfile(post: PostRow): boolean {
  return post.archived !== true;
}

async function followingPlusSelfIds(): Promise<string[] | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: followingRows } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
  const set = new Set<string>((followingRows ?? []).map((r) => r.following_id));
  set.add(user.id);
  return [...set];
}

async function enrichPosts(posts: PostRow[], userId: string): Promise<PostWithMeta[]> {
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.user_id))];

  const [{ data: profiles }, { data: likeRows }, { data: myLikes }, { data: commentRows }, { data: tagRows }] = await Promise.all([
    supabase.from("profiles").select("user_id, name, avatar_url, streak").in("user_id", authorIds),
    supabase.from("post_likes").select("post_id").in("post_id", ids),
    supabase.from("post_likes").select("post_id").eq("user_id", userId).in("post_id", ids),
    supabase.from("post_comments").select("post_id").in("post_id", ids),
    supabase.from("post_tags").select("post_id, tagged_user_id").in("post_id", ids),
  ]);

  const profMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const likeCount = new Map<string, number>();
  for (const r of likeRows ?? []) {
    likeCount.set(r.post_id, (likeCount.get(r.post_id) ?? 0) + 1);
  }
  const commentCount = new Map<string, number>();
  for (const r of commentRows ?? []) {
    commentCount.set(r.post_id, (commentCount.get(r.post_id) ?? 0) + 1);
  }
  const likedSet = new Set((myLikes ?? []).map((r) => r.post_id));

  const taggedIdsByPost = new Map<string, string[]>();
  for (const r of tagRows ?? []) {
    const list = taggedIdsByPost.get(r.post_id) ?? [];
    list.push(r.tagged_user_id);
    taggedIdsByPost.set(r.post_id, list);
  }
  const allTaggedIds = [...new Set((tagRows ?? []).map((r) => r.tagged_user_id))];
  let tagProfMap = new Map<string, PublicProfile>();
  if (allTaggedIds.length) {
    const { data: tagProfs } = await supabase
      .from("profiles")
      .select("user_id, name, avatar_url, streak")
      .in("user_id", allTaggedIds);
    tagProfMap = new Map((tagProfs ?? []).map((p) => [p.user_id, p]));
  }

  return posts.map((p) => ({
    ...p,
    profile: profMap.get(p.user_id) ?? null,
    likeCount: likeCount.get(p.id) ?? 0,
    commentCount: commentCount.get(p.id) ?? 0,
    likedByMe: likedSet.has(p.id),
    taggedUsers: (taggedIdsByPost.get(p.id) ?? []).map((uid) => tagProfMap.get(uid)).filter(Boolean) as PublicProfile[],
  }));
}

export async function fetchPostFeedPage(page: number): Promise<{ data: PostWithMeta[]; hasMore: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], hasMore: false };

  const memberIds = await followingPlusSelfIds();
  if (!memberIds?.length) return { data: [], hasMore: false };

  const from = page * FEED_PAGE;
  const to = from + FEED_PAGE - 1;

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .in("user_id", memberIds)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error || !posts) return { data: [], hasMore: false };

  const visible = posts.filter(isPostVisibleInFeedAndProfile);
  const enriched = await enrichPosts(visible, user.id);
  return { data: enriched, hasMore: posts.length === FEED_PAGE };
}

export async function fetchPostById(postId: string): Promise<PostWithMeta | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: post, error } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  if (error || !post) return null;
  if (post.archived && post.user_id !== user.id) return null;
  const [enriched] = await enrichPosts([post], user.id);
  return enriched ?? null;
}

export async function uploadPostImage(file: File, userId: string): Promise<string> {
  const blob = await compressImageFile(file);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error: upErr } = await supabase.storage.from("posts").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("posts").getPublicUrl(path);
  return pub.publicUrl;
}

export async function createPost(input: {
  content: string;
  imageFile: File | null;
  taggedUserIds: string[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { post: null as PostRow | null, error: new Error("Not signed in") };

  const trimmed = input.content.trim();
  let imageUrl: string | null = null;
  if (input.imageFile) {
    try {
      imageUrl = await uploadPostImage(input.imageFile, user.id);
    } catch (e) {
      return { post: null, error: e instanceof Error ? e : new Error("Upload failed") };
    }
  }

  if (!imageUrl && !trimmed) {
    return { post: null, error: new Error("Add text or an image") };
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      content: trimmed.length > 0 ? trimmed : null,
      image_url: imageUrl,
    })
    .select()
    .single();

  if (error || !post) return { post: null, error: error ?? new Error("Failed to create post") };

  const tags = [...new Set(input.taggedUserIds.filter((id) => id && id !== user.id))];
  if (tags.length) {
    await supabase.from("post_tags").insert(tags.map((tagged_user_id) => ({ post_id: post.id, tagged_user_id })));
  }

  return { post, error: null as Error | null };
}

export async function togglePostLike(postId: string, currentlyLiked: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not signed in") };
  if (currentlyLiked) {
    return supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
  }
  return supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
}

export async function fetchPostComments(postId: string): Promise<PostCommentWithProfile[]> {
  const { data: rows, error } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error || !rows?.length) return [];

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, name, avatar_url, streak")
    .in("user_id", ids);
  const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
  return rows.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
}

export async function addPostComment(postId: string, text: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not signed in") };
  return supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, text: text.trim() });
}

export async function deletePost(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not signed in") };
  return supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
}

const PROFILE_POSTS_PAGE = 12;

/** Lightweight rows for profile grid (no like/comment enrichment). */
export async function fetchCurrentUserPostsPage(
  page: number
): Promise<{ data: PostRow[]; hasMore: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], hasMore: false };

  const from = page * PROFILE_POSTS_PAGE;
  const to = from + PROFILE_POSTS_PAGE - 1;

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error || !data) return { data: [], hasMore: false };
  const visible = data.filter(isPostVisibleInFeedAndProfile);
  return { data: visible, hasMore: data.length === PROFILE_POSTS_PAGE };
}

/** Paginated posts for another member's profile grid (RLS must allow SELECT; see public-profile migration). */
export async function fetchUserPostsPage(
  profileUserId: string,
  page: number
): Promise<{ data: PostRow[]; hasMore: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], hasMore: false };

  const from = page * PROFILE_POSTS_PAGE;
  const to = from + PROFILE_POSTS_PAGE - 1;

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", profileUserId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error || !data) return { data: [], hasMore: false };
  const visible = data.filter(isPostVisibleInFeedAndProfile);
  return { data: visible, hasMore: data.length === PROFILE_POSTS_PAGE };
}

export async function fetchCurrentUserPostCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  return fetchUserPostCountForUser(user.id);
}

/** Public / profile view: non-archived posts by user (subject to RLS). */
export async function fetchUserPostCountForUser(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return 0;
  return count ?? 0;
}

export async function fetchArchivedPostsPage(
  page: number
): Promise<{ data: PostRow[]; hasMore: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], hasMore: false };
  const from = page * PROFILE_POSTS_PAGE;
  const to = from + PROFILE_POSTS_PAGE - 1;
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", user.id)
    .eq("archived", true)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error || !data) return { data: [], hasMore: false };
  return { data, hasMore: data.length === PROFILE_POSTS_PAGE };
}

export async function updatePostCaption(postId: string, content: string, hasImage: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not signed in") };
  const t = content.trim();
  if (!t && !hasImage) return { error: new Error("Caption cannot be empty") };
  return supabase.from("posts").update({ content: t.length > 0 ? t : null }).eq("id", postId).eq("user_id", user.id);
}

export async function setPostArchived(postId: string, archived: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error("Not signed in") };
  const res = await supabase.from("posts").update({ archived }).eq("id", postId).eq("user_id", user.id);
  if (res.error) return { ...res, error: friendlyPostsWriteError(res.error) };
  return res;
}

export async function updatePostFlags(
  postId: string,
  flags: Partial<Pick<PostRow, "comments_enabled" | "share_enabled" | "download_enabled">>
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: new Error("Not signed in") };
  const res = await supabase.from("posts").update(flags).eq("id", postId).eq("user_id", user.id);
  if (res.error) return { ...res, error: friendlyPostsWriteError(res.error) };
  return res;
}
