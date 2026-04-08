import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import MainHeader from "@/components/MainHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { listConversationPreviews, type ConversationPreview } from "@/services/social";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";

const Messages = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileName, setProfileName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listConversationPreviews();
    setRows(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("avatar_url, name").eq("user_id", user.id).maybeSingle();
      if (data) {
        setAvatarUrl(data.avatar_url ?? "");
        setProfileName(data.name || "");
      }
    })();
  }, [user]);

  useEffect(() => {
    const t = window.setInterval(() => void load(), 12_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <MainHeader title="Messages" avatarUrl={avatarUrl} avatarFallback={profileName || "U"} />

      <main className="mx-auto max-w-lg px-4 py-4">
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center shadow-sm border border-border/50">
            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No conversations yet. Open someone&apos;s profile and tap Message.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const otherId = r.otherUser?.user_id;
              return (
                <li key={r.conversationId}>
                  <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm border border-border/40 hover:bg-accent/25 transition-colors">
                    {otherId ? (
                      <Link
                        to={`/u/${otherId}`}
                        className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={r.otherUser?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                            {(r.otherUser?.name || "?")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                    ) : (
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={r.otherUser?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                          {(r.otherUser?.name || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {otherId ? (
                          <Link
                            to={`/u/${otherId}`}
                            className="font-semibold text-foreground truncate block hover:underline"
                          >
                            {r.otherUser?.name || "Member"}
                          </Link>
                        ) : (
                          <p className="font-semibold text-foreground truncate">{r.otherUser?.name || "Member"}</p>
                        )}
                        <Link
                          to={`/messages/${r.conversationId}`}
                          className="text-xs text-muted-foreground truncate block mt-0.5 hover:text-foreground"
                        >
                          {r.lastText || "Say hi 👋"}
                        </Link>
                      </div>
                      <Link
                        to={`/messages/${r.conversationId}`}
                        className="text-[10px] text-muted-foreground shrink-0 tabular-nums pt-0.5 hover:text-foreground"
                      >
                        {formatDistanceToNow(new Date(r.lastAt), { addSuffix: false })}
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Messages;
