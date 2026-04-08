import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import ChatBubble from "@/components/ChatBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

export type AiChatModel = "groq" | "gemini";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const quickPrompts = [
  "Plan my day like a CEO",
  "I feel lazy, fire me up",
  "Give me a life hack I've never heard",
  "Help me build a killer morning routine",
];

const MODEL_OPTIONS: { value: AiChatModel; label: string }[] = [
  { value: "groq", label: "⚡ Groq (Fast)" },
  { value: "gemini", label: "🧠 Gemini (Smart)" },
];

function extractInvokeError(error: unknown, data: unknown): string {
  const ctx = (error as { context?: { body?: string } })?.context;
  if (ctx?.body) {
    try {
      const parsed = JSON.parse(ctx.body) as { error?: string; reply?: string };
      if (parsed?.error) return parsed.error;
    } catch {
      /* ignore */
    }
  }
  if (data && typeof data === "object" && data !== null && "error" in data && !("reply" in data)) {
    return String((data as { error: string }).error);
  }
  return (error as Error)?.message || "Edge function request failed";
}

const AIChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AiChatModel>("groq");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Prevents overlapping sends (double tap / race). */
  const inFlightRef = useRef(false);
  /** Light debounce on submit to absorb accidental double-submits. */
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
    }
  }, [user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !text.trim()) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const userMsg = text.trim();
      const model = selectedModel;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      setInput("");
      setLoading(true);

      const { data: savedUser } = await supabase
        .from("chat_messages")
        .insert({ user_id: user.id, role: "user", content: userMsg })
        .select()
        .single();

      if (savedUser) {
        setMessages((prev) => [...prev, { id: savedUser.id, role: "user", content: userMsg }]);
      }

      try {
        const { data, error } = await supabase.functions.invoke("ai-chat", {
          body: { message: userMsg, model, timezone },
        });

        if (error) {
          throw new Error(extractInvokeError(error, data));
        }

        if (data && typeof data === "object" && "error" in data && !("reply" in data)) {
          throw new Error(String((data as { error: string }).error));
        }

        const reply = (data as { reply?: string })?.reply ?? "Sorry, something went wrong.";

        const { data: savedAi } = await supabase
          .from("chat_messages")
          .insert({ user_id: user.id, role: "assistant", content: reply })
          .select()
          .single();

        if (savedAi) {
          setMessages((prev) => [...prev, { id: savedAi.id, role: "assistant", content: reply }]);
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to get AI response");
      } finally {
        setLoading(false);
        inFlightRef.current = false;
        inputRef.current?.focus();
      }
    },
    [user, selectedModel]
  );

  const clearChat = async () => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("user_id", user.id);
    setMessages([]);
    toast("Chat cleared");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !input.trim()) return;
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    submitTimerRef.current = setTimeout(() => {
      submitTimerRef.current = null;
      const value = inputRef.current?.value?.trim() ?? "";
      if (value) void sendMessage(value);
    }, 280);
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="shrink-0 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 z-10">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary shadow-md">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">LifePilot AI</h1>
              <p className="text-[10px] text-muted-foreground font-medium">Your Elite Performance Coach</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <NotificationBell />
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="rounded-xl p-2 text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        <div className="mx-auto max-w-lg space-y-4 pb-2">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-5 pt-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Ready to crush it?</h2>
                <p className="mt-1 text-sm text-muted-foreground">I'm your personal performance coach. Let's go.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {quickPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={loading}
                    onClick={() => sendMessage(p)}
                    className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Zap className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="rounded-2xl bg-card px-4 py-3 shadow-sm border border-border/50">
                <p className="text-sm font-medium text-foreground">AI is thinking...</p>
                <div className="mt-2 flex gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "120ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "240ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 mb-16">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg gap-2 items-center">
          <label htmlFor="ai-model" className="sr-only">
            AI model
          </label>
          <select
            id="ai-model"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as AiChatModel)}
            disabled={loading}
            className="h-11 max-w-[10.5rem] shrink-0 rounded-2xl border border-border bg-card px-2.5 text-xs sm:text-sm font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 sm:max-w-[11.5rem] sm:px-3"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Input
            ref={inputRef}
            placeholder="Ask your coach anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 min-w-0 rounded-2xl bg-card border-0 shadow-sm h-11"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || !input.trim()}
            className="rounded-2xl shrink-0 h-11 w-11 shadow-sm"
            aria-busy={loading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AIChat;
