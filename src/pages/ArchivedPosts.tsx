import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import MainHeader from "@/components/MainHeader";
import { supabase } from "@/integrations/supabase/client";
import { fetchArchivedPostsPage, setPostArchived, deletePost, type PostRow } from "@/services/posts";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
const ArchivedPosts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileName, setProfileName] = useState("");
  const pageRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (append: boolean) => {
    if (!append) {
      pageRef.current = 0;
      setLoading(true);
      const { data, hasMore: more } = await fetchArchivedPostsPage(0);
      setPosts(data);
      setHasMore(more);
      setLoading(false);
      return;
    }
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    const { data, hasMore: more } = await fetchArchivedPostsPage(nextPage);
    pageRef.current = nextPage;
    setPosts((prev) => [...prev, ...data]);
    setHasMore(more);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("profiles").select("avatar_url, name").eq("user_id", user.id).maybeSingle();
      if (data) {
        setAvatarUrl(data.avatar_url ?? "");
        setProfileName(data.name || "");
      }
    })();
  }, [user]);

  const unarchive = async (id: string) => {
    const { error } = await setPostArchived(id, false);
    if (error) {
      toast.error("Could not restore");
      return;
    }
    toast.success("Post restored");
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete permanently?")) return;
    const { error } = await deletePost(id);
    if (error) {
      toast.error("Could not delete");
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Deleted");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <MainHeader
        title="Archived"
        avatarUrl={avatarUrl}
        avatarFallback={profileName || "U"}
        rightExtra={
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/profile")} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />
      <main className="mx-auto max-w-lg px-4 py-4">
        {loading && posts.length === 0 ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No archived posts.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {posts.map((p) => {
                const hasImage = !!(p.image_url && p.image_url.trim());
                return (
                  <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden border border-border/50 bg-muted/30 flex flex-col">
                    <div className="flex-1 min-h-0">
                      {hasImage ? (
                        <img src={p.image_url!} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center p-1 text-[10px] text-center line-clamp-4">
                          {(p.content || "").trim() || "Note"}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-0.5 bg-background/95 border-t border-border p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 flex-1 text-[10px] px-1 rounded-lg"
                        onClick={() => void unarchive(p.id)}
                      >
                        <RotateCcw className="h-3 w-3 shrink-0" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-7 flex-1 text-[10px] px-1 rounded-lg"
                        onClick={() => void remove(p.id)}
                      >
                        <Trash2 className="h-3 w-3 shrink-0" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <Button variant="outline" className="w-full mt-4 rounded-2xl" onClick={() => void load(true)} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
              </Button>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ArchivedPosts;
