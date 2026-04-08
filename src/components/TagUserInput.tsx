import { useEffect, useRef, useState, type ReactNode } from "react";
import { searchUsers, type PublicProfile } from "@/services/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function compactDisplayName(name: string) {
  return name.replace(/\s+/g, "");
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  tagged: PublicProfile[];
  onTaggedChange: (next: PublicProfile[]) => void;
  excludeUserId?: string;
  placeholder?: string;
  minRows?: number;
  disabled?: boolean;
  className?: string;
  /** Show read-only line with @mentions highlighted */
  showHighlight?: boolean;
};

export function renderCaptionHighlights(text: string, tagged: PublicProfile[]): ReactNode {
  if (!text) return null;
  if (!tagged.length) return text;

  let remaining = text;
  const parts: ReactNode[] = [];
  let key = 0;

  while (remaining.length) {
    let earliest = -1;
    let matchedLen = 0;
    for (const t of tagged) {
      const token = `@${compactDisplayName(t.name)}`;
      const i = remaining.indexOf(token);
      if (i >= 0 && (earliest < 0 || i < earliest)) {
        earliest = i;
        matchedLen = token.length;
      }
    }
    if (earliest < 0) {
      parts.push(remaining);
      break;
    }
    if (earliest > 0) parts.push(remaining.slice(0, earliest));
    parts.push(
      <span key={key++} className="font-semibold text-primary">
        {remaining.slice(earliest, earliest + matchedLen)}
      </span>
    );
    remaining = remaining.slice(earliest + matchedLen);
  }
  return <>{parts}</>;
}

const TagUserInput = ({
  value,
  onChange,
  tagged,
  onTaggedChange,
  excludeUserId,
  placeholder = "What's on your mind?",
  minRows = 4,
  disabled,
  className,
  showHighlight = true,
}: Props) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionHits, setMentionHits] = useState<PublicProfile[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);

  useEffect(() => {
    if (mentionQuery === null || mentionQuery.length < 2) {
      setMentionHits([]);
      return;
    }
    let cancelled = false;
    setMentionLoading(true);
    const t = window.setTimeout(() => {
      void (async () => {
        const { data } = await searchUsers(mentionQuery, excludeUserId, 8);
        if (!cancelled) {
          setMentionHits(data);
          setMentionLoading(false);
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mentionQuery, excludeUserId]);

  const syncMentionFromCaret = (v: string, caret: number | null) => {
    if (caret == null) {
      setMentionQuery(null);
      return;
    }
    const before = v.slice(0, caret);
    const match = before.match(/@([\w.-]*)$/);
    if (match) setMentionQuery(match[1] ?? "");
    else setMentionQuery(null);
  };

  const addTag = (p: PublicProfile) => {
    const el = taRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const token = `@${compactDisplayName(p.name)} `;
    const newBefore = before.replace(/@[\w.-]*$/, token);
    onChange(newBefore + after);
    onTaggedChange(tagged.some((x) => x.user_id === p.user_id) ? tagged : [...tagged, p]);
    setMentionQuery(null);
    setMentionHits([]);
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = newBefore.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const removeTag = (id: string) => {
    onTaggedChange(tagged.filter((x) => x.user_id !== id));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <textarea
        ref={taRef}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          syncMentionFromCaret(e.target.value, e.target.selectionStart);
        }}
        onSelect={(e) => syncMentionFromCaret(e.currentTarget.value, e.currentTarget.selectionStart)}
        onKeyUp={(e) => syncMentionFromCaret(e.currentTarget.value, e.currentTarget.selectionStart)}
        placeholder={placeholder}
        rows={minRows}
        className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
        maxLength={5000}
      />

      {showHighlight && value.trim().length > 0 && tagged.length > 0 && (
        <div
          className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground/90 whitespace-pre-wrap break-words"
          aria-hidden
        >
          {renderCaptionHighlights(value, tagged)}
        </div>
      )}

      {tagged.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tagged.map((t) => (
            <span
              key={t.user_id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              @{compactDisplayName(t.name)}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-primary/20 active:scale-95 transition-transform"
                onClick={() => removeTag(t.user_id)}
                aria-label={`Remove ${t.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {mentionQuery !== null && mentionQuery.length >= 2 && (
        <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden max-h-48 overflow-y-auto animate-in slide-in-from-bottom-2 duration-200">
          {mentionLoading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : mentionHits.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
          ) : (
            <ul>
              {mentionHits.map((p) => (
                <li key={p.user_id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent/60 active:bg-accent transition-colors"
                    onClick={() => addTag(p)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">{p.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default TagUserInput;
