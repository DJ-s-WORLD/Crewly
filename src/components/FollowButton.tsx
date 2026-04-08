import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  followUser,
  unfollowUser,
  getFollowState,
  sendFollowRequest,
  cancelFollowRequest,
  type FollowState,
} from "@/services/social";

type Props = {
  targetUserId: string;
  isPrivate: boolean;
  disabled?: boolean;
  onStateChange?: (state: FollowState) => void;
};

const FollowButton = ({ targetUserId, isPrivate, disabled, onStateChange }: Props) => {
  const [state, setState] = useState<FollowState>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getFollowState(targetUserId);
      setState(s.state);
    })();
  }, [targetUserId]);

  const setAndNotify = (s: FollowState) => {
    setState(s);
    onStateChange?.(s);
  };

  const onClick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      if (state === "following") {
        const { error } = await unfollowUser(targetUserId);
        if (error) toast.error("Could not unfollow");
        else {
          toast.success("Unfollowed");
          setAndNotify("none");
        }
        return;
      }
      if (state === "requested") {
        // Cancel pending request (Instagram behavior).
        const { error } = await cancelFollowRequest(targetUserId);
        if (error) toast.error("Could not cancel request");
        else {
          toast.message("Request canceled");
          setAndNotify("none");
        }
        return;
      }

      // state === none
      if (isPrivate) {
        const { error } = await sendFollowRequest(targetUserId);
        if (error) toast.error("Could not send request");
        else {
          toast.success("Requested");
          setAndNotify("requested");
        }
      } else {
        const { error } = await followUser(targetUserId);
        if (error) toast.error("Could not follow");
        else {
          toast.success("Following!");
          setAndNotify("following");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const label = state === "following" ? "Following" : state === "requested" ? "Requested" : "Follow";

  return (
    <Button
      type="button"
      className="rounded-xl"
      variant={state === "following" ? "outline" : state === "requested" ? "secondary" : "default"}
      disabled={busy || disabled}
      onClick={() => void onClick()}
    >
      {label}
    </Button>
  );
};

export default FollowButton;

