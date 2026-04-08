import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { acceptFollowRequest, rejectFollowRequest } from "@/services/social";
import { toast } from "sonner";

type Props = {
  notificationId: string;
  requestId: string;
  senderId: string;
  title: string;
  body: string;
  read: boolean;
  onOpen?: () => void;
  onDone: (result: "accepted" | "rejected") => void;
};

const FollowRequestCard = ({ notificationId, requestId, senderId, title, body, read, onOpen, onDone }: Props) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [name, setName] = useState<string>("Someone");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [done, setDone] = useState<null | "accepted" | "rejected">(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("user_id", senderId)
        .maybeSingle();
      if (data?.name) setName(data.name);
      setAvatarUrl(data?.avatar_url ?? "");
    })();
  }, [senderId]);

  const initials = useMemo(() => (name || "?")[0]?.toUpperCase() ?? "?", [name]);

  const accept = async () => {
    if (busy) return;
    setBusy("accept");
    const { error } = await acceptFollowRequest(requestId);
    setBusy(null);
    if (error) {
      toast.error("Could not accept");
      return;
    }
    toast.success("Request accepted");
    await supabase
      .from("app_notifications")
      .update({
        type: "follow",
        title: "New follower",
        body: `${name} started following you`,
        read: true,
        data: { sender_id: senderId },
      })
      .eq("id", notificationId);
    setDone("accepted");
    onDone("accepted");
  };

  const reject = async () => {
    if (busy) return;
    setBusy("reject");
    const { error } = await rejectFollowRequest(requestId);
    setBusy(null);
    if (error) {
      toast.error("Could not reject");
      return;
    }
    toast.message("Request declined");
    await supabase
      .from("app_notifications")
      .update({
        type: "follow_rejected",
        title: "Follow request",
        body: `You declined ${name}'s follow request`,
        read: true,
        data: { sender_id: senderId },
      })
      .eq("id", notificationId);
    setDone("rejected");
    onDone("rejected");
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/40",
        !read && "bg-primary/5"
      )}
      role="button"
      tabIndex={0}
      onClick={() => {
        onOpen?.();
        navigate(`/u/${senderId}`);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onOpen?.();
          navigate(`/u/${senderId}`);
        }
      }}
    >
      <Link to={`/u/${senderId}`} className="shrink-0 rounded-xl" onClick={(e) => e.stopPropagation()}>
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="bg-primary/15 text-primary font-semibold">{initials}</AvatarFallback>
        </Avatar>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            to={`/u/${senderId}`}
            className="text-sm font-semibold text-foreground truncate hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {name}
          </Link>
          <span className="text-[10px] text-muted-foreground">{title}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {done === "accepted"
            ? `${name} started following you`
            : done === "rejected"
              ? `You declined ${name}'s follow request`
              : body}
        </p>

        {done === null && (
          <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-xl px-3"
              disabled={busy !== null}
              onClick={() => void accept()}
            >
              <Check className="h-4 w-4 mr-1" />
              Accept
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 rounded-xl px-3"
              disabled={busy !== null}
              onClick={() => void reject()}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowRequestCard;

