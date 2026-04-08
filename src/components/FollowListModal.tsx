import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { fetchFollowersProfiles, fetchFollowingProfiles, followUser, unfollowUser, isFollowing } from "@/services/social";
import type { PublicProfile } from "@/services/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "followers" | "following";

type Props = {
  userId: string;
  mode: Mode;
  open: boolean;
  onClose: () => void;
};

const FollowListModal = ({ userId, mode, open, onClose }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [followState, setFollowState] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const data = mode === "followers" ? await fetchFollowersProfiles(userId) : await fetchFollowingProfiles(userId);
    setRows(data);
    if (user) {
      const entries = await Promise.all(
        data.map(
          async (p) =>
            [p.user_id, p.user_id === user.id ? false : await isFollowing(p.user_id)] as const
        )
      );
      setFollowState(Object.fromEntries(entries));
    }
    setLoading(false);
  }, [userId, mode, user]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const toggleFollow = async (targetId: string) => {
    if (!user || targetId === user.id) return;
    const currently = followState[targetId];
    if (currently) {
      const { error } = await unfollowUser(targetId);
      if (error) toast.error("Could not unfollow");
      else {
        setFollowState((s) => ({ ...s, [targetId]: false }));
        toast.success("Unfollowed");
      }
    } else {
      const { error } = await followUser(targetId);
      if (error) toast.error("Could not follow");
      else {
        setFollowState((s) => ({ ...s, [targetId]: true }));
        toast.success("Following!");
      }
    }
  };

  if (!open) return null;

  const title = mode === "followers" ? "Followers" : "Following";

  return (
    <>
      <button type="button" className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div
        className={cn(
          "fixed z-[61] animate-in fade-in slide-in-from-bottom duration-200",
          "inset-x-0 bottom-0 max-h-[min(72vh,32rem)] mx-auto max-w-lg sm:max-w-md rounded-t-3xl border border-border bg-card shadow-2xl",
          "flex flex-col pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        )}
        role="dialog"
        aria-labelledby="follow-list-title"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <h2 id="follow-list-title" className="text-base font-semibold">
            {title}
          </h2>
          <button type="button" className="rounded-full p-2 hover:bg-accent" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10 px-4">No one here yet.</p>
          ) : (
            <ul className="space-y-1">
              {rows.map((p) => (
                <li
                  key={p.user_id}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-accent/40 transition-colors"
                >
                  <button
                    type="button"
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
                    onClick={() => {
                      onClose();
                      navigate(`/u/${p.user_id}`);
                    }}
                  >
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/15 text-primary font-semibold">{(p.name || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground truncate">{p.name}</span>
                  </button>
                  {user && p.user_id !== user.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant={followState[p.user_id] ? "outline" : "default"}
                      className="rounded-full shrink-0 text-xs px-3"
                      onClick={() => void toggleFollow(p.user_id)}
                    >
                      {followState[p.user_id] ? "Unfollow" : "Follow"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default FollowListModal;
