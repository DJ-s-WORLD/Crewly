import { useCallback, useEffect, useRef, useState } from "react";
import PostCard from "@/components/PostCard";
import { fetchFeedPosts, fetchPostFeedPage, type FeedScope, type PostWithMeta } from "@/services/posts";
import { Loader2 } from "lucide-react";

type Props = {
  onPostUpdated?: () => void;
  /** Bumps refetch when changed (e.g. after navigation). */
  refreshKey?: string | number;
  /** `global` = public discovery + people you follow (RLS). `following` = legacy circle-only (future toggle). */
  feedScope?: FeedScope;
  /** Show follow on each post header (feed / discovery). */
  showAuthorFollow?: boolean;
  headerExtra?: React.ReactNode;
  emptyCta?: React.ReactNode;
};

const InfiniteFeed = ({
  onPostUpdated,
  refreshKey = 0,
  feedScope = "global",
  showAuthorFollow = true,
  headerExtra,
  emptyCta,
}: Props) => {
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef(0);
  const guardRef = useRef(false);
  const mergePosts = useCallback((prev: PostWithMeta[], next: PostWithMeta[]) => {
    const ids = new Set(prev.map((p) => p.id));
    const merged = [...prev];
    for (const p of next) {
      if (!ids.has(p.id)) {
        ids.add(p.id);
        merged.push(p);
      }
    }
    return merged;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    pageRef.current = 0;
    const { data, hasMore: more } =
      feedScope === "global" ? await fetchFeedPosts(0) : await fetchPostFeedPage(0, "following");
    setPosts(data);
    setHasMore(more);
    setLoading(false);
  }, [feedScope]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const loadNext = useCallback(async () => {
    if (guardRef.current || !hasMore || loading || loadingMore) return;
    guardRef.current = true;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    const { data, hasMore: more } =
      feedScope === "global" ? await fetchFeedPosts(next) : await fetchPostFeedPage(next, "following");
    pageRef.current = next;
    setPosts((prev) => mergePosts(prev, data));
    setHasMore(more);
    setLoadingMore(false);
    guardRef.current = false;
  }, [hasMore, loading, loadingMore, mergePosts, feedScope]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) void loadNext();
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, loadNext]);

  const bumpParent = () => {
    onPostUpdated?.();
    void refresh();
  };

  return (
    <>
      {headerExtra}
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              No posts yet. When people share publicly, they&apos;ll show up here — or create the first one.
            </p>
            {emptyCta}
          </div>
        ) : (
          <>
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                showAuthorFollow={showAuthorFollow}
                onPostUpdated={bumpParent}
                onPostRemoved={bumpParent}
              />
            ))}
            <div ref={sentinelRef} className="h-6" aria-hidden />
            {loadingMore && (
              <div className="flex justify-center py-6" aria-busy="true">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <p className="text-center text-xs text-muted-foreground pb-4">You&apos;re up to date</p>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default InfiniteFeed;
