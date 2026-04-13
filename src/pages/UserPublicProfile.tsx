import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import MainHeader from "@/components/MainHeader";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  followUser,
  unfollowUser,
  getFollowCounts,
  isFollowing,
  getOrCreateConversation,
  getRecentActivitiesForUser,
  getFollowState,
  acceptFollowRequest,
  rejectFollowRequest,
} from "@/services/social";
import { fetchUserPostCountForUser } from "@/services/posts";
import ProfileStats from "@/components/ProfileStats";
import FollowListModal from "@/components/FollowListModal";
import ProfileHeaderHorizontal from "@/components/ProfileHeaderHorizontal";
import FollowButton from "@/components/FollowButton";
import PrivateAccountNotice from "@/components/PrivateAccountNotice";
import PostsGrid from "@/components/PostsGrid";
import TodayMoodSection from "@/components/TodayMoodSection";
import { Flame, MessageCircle, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const UserPublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [followingThem, setFollowingThem] = useState(false);
  const [followState, setFollowState] = useState<"none" | "requested" | "following">("none");
  const [busy, setBusy] = useState(false);
  const [acts, setActs] = useState<Tables<"activities">[]>([]);
  const [meAvatar, setMeAvatar] = useState("");
  const [meName, setMeName] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [postsCount, setPostsCount] = useState(0);
  const [followModal, setFollowModal] = useState<null | "followers" | "following">(null);
  const [incomingRequestId, setIncomingRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setPageLoading(true);
    const [{ data: p }, counts, fol, { data: activityRows }, publicPosts, incomingReq] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      getFollowCounts(userId),
      user ? isFollowing(userId) : Promise.resolve(false),
      getRecentActivitiesForUser(userId, 6),
      fetchUserPostCountForUser(userId),
      user
        ? supabase
            .from("follow_requests")
            .select("id, status")
            .eq("sender_id", userId)
            .eq("receiver_id", user.id)
            .eq("status", "pending")
            .maybeSingle()
        : Promise.resolve({ data: null } as { data: { id: string; status: string } | null }),
    ]);
    setProfile(p);
    setPostsCount(publicPosts);
    setFollowers(counts.followers);
    setFollowing(counts.following);
    setFollowingThem(fol);
    const fs = user ? await getFollowState(userId) : { state: "none" as const };
    setFollowState(fs.state);
    setIncomingRequestId(incomingReq?.data?.id ?? null);
    setActs(activityRows ?? []);
    setPageLoading(false);
  }, [userId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("avatar_url, name").eq("user_id", user.id).maybeSingle();
      if (data) {
        setMeAvatar(data.avatar_url ?? "");
        setMeName(data.name || "");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (user && userId && user.id === userId) {
      navigate("/profile", { replace: true });
    }
  }, [user, userId, navigate]);

  /** Public profile: posts + lists like Instagram. Private: only after accepted follow. */
  const canSeePrivateContent = !profile?.is_private || followingThem;
  const canOpenFollowLists = canSeePrivateContent;

  const openChat = async () => {
    if (!userId) return;
    const { conversationId, error } = await getOrCreateConversation(userId);
    if (error || !conversationId) {
      toast.error("Could not open messages");
      return;
    }
    navigate(`/messages/${conversationId}`);
  };

  if (!userId || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pb-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background pb-24 px-4">
        <p className="text-muted-foreground text-sm text-center">Profile not found</p>
        <Button variant="outline" className="rounded-xl" onClick={() => navigate("/feed")}>
          Back to feed
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <MainHeader avatarUrl={meAvatar} avatarFallback={meName || "U"} />
      <div className="mx-auto max-w-lg pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="bg-card/80 pb-5 p-2">
          <ProfileHeaderHorizontal
            avatarUrl={profile.avatar_url || ""}
            username={profile.name || "Member"}
            uid={profile.uid ?? null}
            editingName={false}
            nameInput=""
            onNameInputChange={() => {}}
            onStartEditName={() => {}}
            onSaveName={() => {}}
            fileInputRef={{ current: null }}
            onAvatarChange={() => {}}
            postsCount={postsCount}
            followers={followers}
            following={following}
            onFollowersClick={
              canOpenFollowLists
                ? () => setFollowModal("followers")
                : () => toast.message("This account is private")
            }
            onFollowingClick={
              canOpenFollowLists
                ? () => setFollowModal("following")
                : () => toast.message("This account is private")
            }
            bioLine={
              profile.is_private
                ? "Private account"
                : profile.streak
                  ? `🔥 ${profile.streak} day streak`
                  : null
            }
          />

          <div className="flex gap-2 justify-end">
            <FollowButton
              targetUserId={userId}
              isPrivate={!!profile.is_private}
              disabled={busy || !user}
              onStateChange={(s) => {
                setFollowState(s);
                setFollowingThem(s === "following");
                void load();
              }}
            />
            {(!profile.is_private || canSeePrivateContent) && (
              <Button className="rounded-xl gap-2" variant="secondary" onClick={() => void openChat()}>
                <MessageCircle className="h-4 w-4" />
                Message
              </Button>
            )}
          </div>

          <div className="mt-4 px-1">
            <TodayMoodSection mood={profile.mood} moodUpdatedAt={profile.mood_updated_at} />
          </div>
        </div>

        {incomingRequestId && user && (
          <div className="mt-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Follow request</p>
            <p className="mt-1 text-xs text-muted-foreground">
              This user has requested to follow you. Accepting will allow them to see your private posts.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                className="rounded-xl"
                onClick={async () => {
                  const { error } = await acceptFollowRequest(incomingRequestId);
                  if (error) toast.error("Could not accept");
                  else {
                    toast.success("Request accepted");
                    setIncomingRequestId(null);
                    void load();
                  }
                }}
              >
                Accept
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                onClick={async () => {
                  const { error } = await rejectFollowRequest(incomingRequestId);
                  if (error) toast.error("Could not reject");
                  else {
                    toast.message("Request declined");
                    setIncomingRequestId(null);
                    void load();
                  }
                }}
              >
                Reject
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6">
          {profile.is_private && !canSeePrivateContent ? (
            <PrivateAccountNotice text="Follow to see posts." />
          ) : (
            <PostsGrid profileUserId={userId} refreshKey={`${userId}-${followers}-${postsCount}-${followState}`} />
          )}
        </div>

        {canSeePrivateContent && (
          <div className="mt-5 rounded-2xl bg-card p-4 shadow-sm border border-border/50">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent activity</h2>
            {acts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No public activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {acts.map((a) => (
                  <li key={a.id} className="rounded-xl bg-background/80 px-3 py-2 text-sm text-foreground border border-border/40">
                    {a.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-center mt-6 text-xs text-muted-foreground">
          <Link to="/feed" className="text-primary font-medium">
            Back to feed
          </Link>
        </p>
      </div>

      {userId && (
        <FollowListModal
          userId={userId}
          mode={followModal === "following" ? "following" : "followers"}
          open={followModal !== null}
          onClose={() => setFollowModal(null)}
        />
      )}
    </div>
  );
};

export default UserPublicProfile;
