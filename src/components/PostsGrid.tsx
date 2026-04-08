import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PostRow } from "@/services/posts";
import { fetchCurrentUserPostsPage, fetchUserPostsPage } from "@/services/posts";
import { Loader2, Type } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Change to refetch the first page (e.g. after navigation back to profile). */
  refreshKey?: string | number;
  /** Load this user's posts (public profile). Omit for current user only. */
  profileUserId?: string;
};

const PostsGrid = ({ refreshKey = 0, profileUserId }: Props) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const guardRef = useRef(false);

  const resetAndLoad = useCallback(async () => {
    setLoading(true);
    setPage(0);
    const { data, hasMore: more } = profileUserId
      ? await fetchUserPostsPage(profileUserId, 0)
      : await fetchCurrentUserPostsPage(0);
    setPosts(data);
    setHasMore(more);
    setLoading(false);
  }, [profileUserId]);

  useEffect(() => {
    void resetAndLoad();
  }, [resetAndLoad, refreshKey, profileUserId]);

  const loadMore = useCallback(async () => {
    if (guardRef.current || !hasMore || loading) return;
    guardRef.current = true;
    setLoadingMore(true);
    const next = page + 1;
    const { data, hasMore: more } = profileUserId
      ? await fetchUserPostsPage(profileUserId, next)
      : await fetchCurrentUserPostsPage(next);
    setPage(next);
    setPosts((prev) => [...prev, ...data]);
    setHasMore(more);
    setLoadingMore(false);
    guardRef.current = false;
  }, [hasMore, loading, page, profileUserId]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) void loadMore();
      },
      { rootMargin: "100px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Posts</h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-12 text-center">
          <p className="text-sm text-muted-foreground px-4">
            {profileUserId
              ? "No posts yet."
              : "No posts yet. Share a photo or thought from the + button."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {posts.map((p) => {
              const hasImage = !!(p.image_url && p.image_url.trim());
              const text = (p.content || "").trim();
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/post/${p.id}`)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted/40",
                    "transition-transform active:scale-[0.97] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  {hasImage ? (
                    <img
                      src={p.image_url!}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/15 via-card to-primary/5 p-2">
                      <Type className="h-5 w-5 text-primary/70 shrink-0" />
                      <p className="text-[10px] leading-snug text-foreground/80 line-clamp-4 text-center font-medium">
                        {text || "Note"}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div ref={sentinelRef} className="h-2" />
          {loadingMore && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default PostsGrid;
