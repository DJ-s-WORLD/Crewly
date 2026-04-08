import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PublicProfile = Pick<Tables<"profiles">, "user_id" | "name" | "avatar_url" | "streak" | "uid" | "is_private">;

export type FeedItem = Tables<"activities"> & { profile?: PublicProfile | null };

export async function followUser(followingId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === followingId) return { error: new Error("Invalid follow") };
  return supabase.from("follows").insert({ follower_id: user.id, following_id: followingId });
}

export async function unfollowUser(followingId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not signed in") };
  return supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", followingId);
}

export type FollowState = "none" | "requested" | "following";

export async function getFollowState(targetUserId: string): Promise<{ state: FollowState; requestId: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { state: "none", requestId: null };
  const [{ data: f }, { data: req }] = await Promise.all([
    supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", targetUserId).maybeSingle(),
    supabase
      .from("follow_requests")
      .select("id, status")
      .eq("sender_id", user.id)
      .eq("receiver_id", targetUserId)
      .maybeSingle(),
  ]);
  if (f) return { state: "following", requestId: null };
  if (req?.status === "pending") return { state: "requested", requestId: req.id };
  return { state: "none", requestId: null };
}

export async function sendFollowRequest(receiverId: string) {
  const { data, error } = await supabase.rpc("send_follow_request", { p_receiver: receiverId });
  return { requestId: data ?? null, error };
}

export async function acceptFollowRequest(requestId: string) {
  const { error } = await supabase.rpc("accept_follow_request", { p_request_id: requestId });
  return { error };
}

export async function rejectFollowRequest(requestId: string) {
  const { error } = await supabase.rpc("reject_follow_request", { p_request_id: requestId });
  return { error };
}

export async function cancelFollowRequest(receiverId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not signed in") };
  return supabase
    .from("follow_requests")
    .delete()
    .eq("sender_id", user.id)
    .eq("receiver_id", receiverId)
    .eq("status", "pending");
}

export async function getFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function isFollowing(targetUserId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();
  return !!data;
}

/** Profiles of users who follow `forUserId`. */
export async function fetchFollowersProfiles(forUserId: string): Promise<PublicProfile[]> {
  const { data: follows, error } = await supabase.from("follows").select("follower_id").eq("following_id", forUserId);
  if (error || !follows?.length) return [];
  const ids = [...new Set(follows.map((f) => f.follower_id))];
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, name, avatar_url, streak")
    .in("user_id", ids);
  return profs ?? [];
}

/** Profiles of users `forUserId` follows. */
export async function fetchFollowingProfiles(forUserId: string): Promise<PublicProfile[]> {
  const { data: follows, error } = await supabase.from("follows").select("following_id").eq("follower_id", forUserId);
  if (error || !follows?.length) return [];
  const ids = [...new Set(follows.map((f) => f.following_id))];
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, name, avatar_url, streak")
    .in("user_id", ids);
  return profs ?? [];
}

export async function searchUsers(query: string, excludeUserId?: string, limit = 12) {
  const q = query.trim();
  if (q.length < 2) return { data: [] as PublicProfile[] };
  const numeric = /^\d{4,6}$/.test(q);
  let req = supabase
    .from("profiles")
    .select("user_id, name, avatar_url, streak, uid, is_private")
    .limit(limit);
  req = numeric ? req.eq("uid", Number(q)) : req.ilike("name", `%${q}%`);
  if (excludeUserId) req = req.neq("user_id", excludeUserId);
  const { data, error } = await req;
  return { data: data ?? [], error };
}

export async function getActivityFeed(limit = 40): Promise<{ data: FeedItem[]; error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };

  const { data: followingRows } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
  const followingSet = new Set((followingRows ?? []).map((r) => r.following_id));
  followingSet.add(user.id);

  const { data: acts, error } = await supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit * 3, 120));

  if (error) return { data: [], error: error as Error };

  const filtered = (acts ?? []).filter((a) => followingSet.has(a.user_id)).slice(0, limit);
  if (!filtered.length) return { data: [], error: null };

  const ids = [...new Set(filtered.map((a) => a.user_id))];
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, name, avatar_url, streak")
    .in("user_id", ids);

  const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
  return {
    data: filtered.map((a) => ({ ...a, profile: map.get(a.user_id) ?? null })),
    error: null,
  };
}

export async function getRecentActivitiesForUser(userId: string, limit = 8) {
  return supabase
    .from("activities")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function getOrCreateConversation(otherUserId: string) {
  const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
    p_other_user: otherUserId,
  });
  return { conversationId: data as string | null, error };
}

export async function sendSocialMessage(conversationId: string, text: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not signed in") };
  return supabase.from("social_messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    text: text.trim(),
  });
}

export async function fetchConversationMessages(conversationId: string) {
  return supabase
    .from("social_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
}

export type ConversationPreview = {
  conversationId: string;
  otherUser: PublicProfile | null;
  lastText: string;
  lastAt: string;
};

export async function listConversationPreviews(): Promise<ConversationPreview[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user.id);

  const convIds = [...new Set((mine ?? []).map((m) => m.conversation_id))];
  if (!convIds.length) return [];

  const { data: convs } = await supabase
    .from("conversations")
    .select("id, updated_at")
    .in("id", convIds)
    .order("updated_at", { ascending: false })
    .limit(40);

  const out: ConversationPreview[] = [];

  for (const c of convs ?? []) {
    const { data: otherId } = await supabase.rpc("get_other_participant", { p_conversation_id: c.id });
    if (!otherId) continue;

    const { data: prof } = await supabase
      .from("profiles")
      .select("user_id, name, avatar_url, streak")
      .eq("user_id", otherId)
      .maybeSingle();

    const { data: lastMsgs } = await supabase
      .from("social_messages")
      .select("text, created_at")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const last = lastMsgs?.[0];
    out.push({
      conversationId: c.id,
      otherUser: prof,
      lastText: last?.text ?? "",
      lastAt: last?.created_at ?? c.updated_at,
    });
  }

  return out;
}

export async function fetchNotifications(limit = 50) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [] as Tables<"app_notifications">[], error: null };
  return supabase
    .from("app_notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return { error: null };
  return supabase.from("app_notifications").update({ read: true }).in("id", ids);
}

export async function markAllNotificationsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not signed in") };
  return supabase.from("app_notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
}

export async function deleteNotification(notificationId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not signed in") };
  return supabase.from("app_notifications").delete().eq("id", notificationId).eq("user_id", user.id);
}
