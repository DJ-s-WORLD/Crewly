import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import MainHeader from "@/components/MainHeader";
import InfiniteFeed from "@/components/InfiniteFeed";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCreatePostUI } from "@/context/CreatePostUIContext";

const Feed = () => {
  const { user } = useAuth();
  const { openCreatePost } = useCreatePostUI();
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileName, setProfileName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("avatar_url, name").eq("user_id", user.id).maybeSingle();
    if (data) {
      setAvatarUrl(data.avatar_url ?? "");
      setProfileName(data.name || "");
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <MainHeader title="Feed" avatarUrl={avatarUrl} avatarFallback={profileName || user?.email || "U"} />

      <div className="mx-auto max-w-lg px-4 pt-3 flex justify-between items-center gap-2">
        <p className="text-xs text-muted-foreground">
          Discover public posts from everyone, plus posts from people you follow (private accounts stay private).
        </p>
        <Button size="sm" className="rounded-full gap-1 shrink-0 h-9" onClick={() => openCreatePost()}>
          Post
        </Button>
      </div>

      <InfiniteFeed
        refreshKey={refreshKey}
        onPostUpdated={() => setRefreshKey((k) => k + 1)}
        emptyCta={
          <Button type="button" onClick={() => openCreatePost()}>
            Create post
          </Button>
        }
      />
    </div>
  );
};

export default Feed;
