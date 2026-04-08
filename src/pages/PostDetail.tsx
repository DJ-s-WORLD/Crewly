import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import MainHeader from "@/components/MainHeader";
import PostCard from "@/components/PostCard";
import { fetchPostById, type PostWithMeta } from "@/services/posts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostWithMeta | null | undefined>(undefined);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileName, setProfileName] = useState("");

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

  const reloadPost = useCallback(async () => {
    if (!id) return;
    const p = await fetchPostById(id);
    setPost(p);
  }, [id]);

  useEffect(() => {
    if (!id) {
      setPost(null);
      return;
    }
    setPost(undefined);
    void reloadPost();
  }, [id, reloadPost]);

  if (post === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (post === null) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <MainHeader title="Post" avatarUrl={avatarUrl} avatarFallback={profileName || "U"} />
        <div className="mx-auto max-w-lg px-4 py-12 text-center space-y-4">
          <p className="text-muted-foreground text-sm">This post isn&apos;t available or you don&apos;t follow the author.</p>
          <Button variant="outline" onClick={() => navigate("/feed")}>
            Back to feed
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <MainHeader
        title="Post"
        avatarUrl={avatarUrl}
        avatarFallback={profileName || "U"}
        rightExtra={
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />

      <main className="mx-auto max-w-lg px-4 py-4">
        <PostCard
          post={post}
          expandComments
          onPostUpdated={() => void reloadPost()}
          onPostRemoved={() => void reloadPost()}
        />
      </main>
    </div>
  );
};

export default PostDetail;
