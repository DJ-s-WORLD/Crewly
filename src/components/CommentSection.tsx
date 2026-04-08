import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { addPostComment, fetchPostComments, type PostCommentWithProfile } from "@/services/posts";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

type Props = {
  postId: string;
  /** If false, hide composer (e.g. feed preview). */
  showComposer?: boolean;
  /** When false, comments are disabled for this post (owner setting). */
  commentsEnabled?: boolean;
  onCommentAdded?: () => void;
};

const CommentSection = ({ postId, showComposer = true, commentsEnabled = true, onCommentAdded }: Props) => {
  const [comments, setComments] = useState<PostCommentWithProfile[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchPostComments(postId);
    setComments(rows);
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`post_comments:${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [postId, load]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const { error } = await addPostComment(postId, t);
    setSending(false);
    if (error) {
      toast.error("Could not post comment");
      return;
    }
    setText("");
    onCommentAdded?.();
    void load();
  };

  return (
    <div className="space-y-3">
      {!commentsEnabled && (
        <p className="text-xs text-muted-foreground rounded-xl bg-muted/40 px-3 py-2 border border-border/50">
          Comments are turned off for this post.
        </p>
      )}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No comments yet. Start the thread.</p>
      ) : (
        <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={c.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/15 text-primary font-bold">
                  {(c.profile?.name || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 rounded-xl bg-muted/40 px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-foreground">{c.profile?.name || "Member"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showComposer && commentsEnabled && (
        <div className="flex gap-2 items-end pt-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            maxLength={2000}
          />
          <Button type="button" size="icon" className="shrink-0 h-10 w-10 rounded-xl" disabled={sending || !text.trim()} onClick={() => void send()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CommentSection;
