import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ProfileHeader from "@/components/ProfileHeader";
import ProfileHeaderHorizontal from "@/components/ProfileHeaderHorizontal";
import SettingsModal from "@/components/SettingsModal";
import PostsGrid from "@/components/PostsGrid";
import ShareProfileCardPremium from "@/components/ShareProfileCardPremium";
import FollowListModal from "@/components/FollowListModal";
import { Flame, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getFollowCounts } from "@/services/social";
import { fetchCurrentUserPostCount } from "@/services/posts";
import { cn } from "@/lib/utils";

const moods = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😎", label: "Confident" },
  { emoji: "🔥", label: "Fired Up" },
  { emoji: "😴", label: "Tired" },
  { emoji: "😤", label: "Frustrated" },
  { emoji: "🧘", label: "Calm" },
  { emoji: "🤔", label: "Thinking" },
  { emoji: "😢", label: "Sad" },
];

const Profile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [mood, setMood] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPoster, setShowPoster] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [uid, setUid] = useState<number | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [followModal, setFollowModal] = useState<null | "followers" | "following">(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [profileRes, tasksRes, counts, postCount] = await Promise.all([
      supabase.from("profiles").select("name, streak, avatar_url, mood, bg_color, uid, is_private").eq("user_id", user.id).maybeSingle(),
      supabase.from("tasks").select("id", { count: "exact" }).eq("user_id", user.id).eq("completed", true),
      getFollowCounts(user.id),
      fetchCurrentUserPostCount(),
    ]);
    if (profileRes.data) {
      setName(profileRes.data.name || user.user_metadata?.name || "");
      setStreak(profileRes.data.streak || 0);
      setAvatarUrl(profileRes.data.avatar_url || "");
      setMood(profileRes.data.mood || "");
      setUid(profileRes.data.uid ?? null);
      setIsPrivate(!!profileRes.data.is_private);
    }
    setTotalCompleted(tasksRes.count || 0);
    setFollowers(counts.followers);
    setFollowing(counts.following);
    setPostsCount(postCount);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile, location.key]);

  const handleSignOut = async () => {
    setSettingsOpen(false);
    await signOut();
    toast("Signed out");
  };

  const handleSaveName = async () => {
    if (!user || !nameInput.trim()) return;
    await supabase.from("profiles").update({ name: nameInput.trim() }).eq("user_id", user.id);
    setName(nameInput.trim());
    setEditingName(false);
    toast.success("Name updated!");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Upload failed");
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = urlData.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setAvatarUrl(url);
    toast.success("Profile picture updated!");
  };

  const handleMoodSelect = async (emoji: string) => {
    if (!user) return;
    setMood(emoji);
    await supabase.from("profiles").update({ mood: emoji }).eq("user_id", user.id);
    toast.success("Mood updated!");
  };

  const moodLabel = moods.find((m) => m.emoji === mood)?.label;
  const bioLine = mood && moodLabel ? `${mood} ${moodLabel}` : mood || null;

  const joinedLabel = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <ProfileHeader username={name || "Profile"} onOpenSettings={() => setSettingsOpen(true)} />

      <main className="mx-auto max-w-lg px-4 py-5 space-y-6">
        <ProfileHeaderHorizontal
          avatarUrl={avatarUrl}
          username={name}
          uid={uid}
          isPrivate={isPrivate}
          editingName={editingName}
          nameInput={nameInput}
          onNameInputChange={setNameInput}
          onStartEditName={() => {
            setNameInput(name);
            setEditingName(true);
          }}
          onSaveName={() => void handleSaveName()}
          onShare={() => setShowPoster(true)}
          fileInputRef={fileInputRef}
          onAvatarChange={(e) => void handleAvatarUpload(e)}
          postsCount={postsCount}
          followers={followers}
          following={following}
          onFollowersClick={() => setFollowModal("followers")}
          onFollowingClick={() => setFollowModal("following")}
          bioLine={bioLine}
        />

        <div
          className={cn(
            "rounded-2xl border border-border/60 bg-card/60 p-4 shadow-md",
            "backdrop-blur-sm transition-shadow hover:shadow-lg"
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 text-center">
            Today&apos;s mood
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:thin]">
            {moods.map((m) => (
              <button
                key={m.emoji}
                type="button"
                onClick={() => void handleMoodSelect(m.emoji)}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 min-w-[4.25rem] transition-all",
                  "border border-transparent active:scale-95",
                  mood === m.emoji
                    ? "bg-primary/15 ring-2 ring-primary shadow-sm scale-[1.02]"
                    : "bg-muted/40 hover:bg-muted/70"
                )}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[9px] text-muted-foreground font-medium">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm",
              "transition-transform active:scale-[0.99]"
            )}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-streak/15">
              <Flame className="h-5 w-5 text-streak" />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">{streak}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Day streak</p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm",
              "transition-transform active:scale-[0.99]"
            )}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/15">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">{totalCompleted}</p>
              <p className="text-[11px] text-muted-foreground font-medium">Tasks done</p>
            </div>
          </div>
        </div>

        <PostsGrid refreshKey={location.key} />
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        email={user?.email}
        joinedLabel={joinedLabel}
        onSignOut={handleSignOut}
        onViewArchived={() => {
          setSettingsOpen(false);
          navigate("/profile/archived");
        }}
        privacyValue={isPrivate}
        onTogglePrivacy={async (v) => {
          if (!user) return;
          setIsPrivate(v);
          await supabase.from("profiles").update({ is_private: v }).eq("user_id", user.id);
          toast.success(v ? "Private account enabled" : "Private account disabled");
        }}
      />

      {user && (
        <FollowListModal
          userId={user.id}
          mode={followModal === "following" ? "following" : "followers"}
          open={followModal !== null}
          onClose={() => setFollowModal(null)}
        />
      )}

      {showPoster && (
        <ShareProfileCardPremium
          name={name}
          avatarUrl={avatarUrl}
          postsCount={postsCount}
          followers={followers}
          following={following}
          onClose={() => setShowPoster(false)}
        />
      )}
    </div>
  );
};

export default Profile;
