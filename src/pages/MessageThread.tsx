import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchConversationMessages, sendSocialMessage } from "@/services/social";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";

const MessageThread = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Tables<"social_messages">[]>([]);
  const [title, setTitle] = useState("");
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherAvatarUrl, setOtherAvatarUrl] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!conversationId || !user) return;
    const { data, error } = await fetchConversationMessages(conversationId);
    if (error) return;
    setMessages(data ?? []);
    const { data: other } = await supabase.rpc("get_other_participant", { p_conversation_id: conversationId });
    if (other) {
      setOtherUserId(other);
      const { data: prof } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("user_id", other)
        .maybeSingle();
      setTitle(prof?.name || "Chat");
      setOtherAvatarUrl(prof?.avatar_url ?? "");
    } else {
      setOtherUserId(null);
      setOtherAvatarUrl("");
    }
  }, [conversationId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!conversationId) return;
    const t = window.setInterval(() => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      void (async () => {
        const { data } = await fetchConversationMessages(conversationId);
        if (data) setMessages(data);
        inFlightRef.current = false;
      })();
    }, 5000);
    return () => clearInterval(t);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!conversationId || !input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    const { error } = await sendSocialMessage(conversationId, text);
    if (error) {
      toast.error("Message not sent");
      setInput(text);
    } else {
      await load();
    }
    setSending(false);
  };

  if (!conversationId) return null;

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="shrink-0 z-20 flex items-center gap-2 border-b border-border bg-card/90 px-3 py-3 backdrop-blur-md">
        <Button type="button" variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={() => navigate("/messages")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {otherUserId ? (
          <Link
            to={`/u/${otherUserId}`}
            className="min-w-0 flex-1 flex items-center gap-2 rounded-xl py-0.5 pr-1 hover:bg-accent/30 transition-colors"
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={otherAvatarUrl || undefined} />
              <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
                {(title || "?")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <h1 className="text-base font-bold text-foreground truncate">{title}</h1>
              <p className="text-[10px] text-muted-foreground">View profile</p>
            </div>
          </Link>
        ) : (
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-foreground truncate">{title}</h1>
            <p className="text-[10px] text-muted-foreground">End-to-end motivation ✨</p>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 min-h-0">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 shadow-sm text-sm",
                  mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md border border-border/50"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={cn("mt-1 text-[10px] opacity-70", mine ? "text-primary-foreground" : "text-muted-foreground")}>
                  {format(new Date(m.created_at), "HH:mm")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form
          className="mx-auto flex max-w-lg gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message…"
            className="rounded-2xl bg-background"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !input.trim()} className="rounded-2xl px-4">
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};

export default MessageThread;
