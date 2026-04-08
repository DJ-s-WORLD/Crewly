import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { searchUsers, type PublicProfile } from "@/services/social";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

const SearchBarInline = ({ className }: Props) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 280);
    return () => clearTimeout(t);
  }, [q]);

  const runSearch = useCallback(async () => {
    if (!user || debounced.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const { data } = await searchUsers(debounced, user.id, 12);
    setResults(data);
    setLoading(false);
  }, [user, debounced]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <div className={cn("relative flex items-center justify-end gap-1 min-w-0", className)}>
      <div
        className={cn(
          "flex items-center gap-1 overflow-hidden transition-all duration-300 ease-out",
          expanded ? "flex-1 max-w-[min(20rem,calc(100vw-8rem))]" : "max-w-10"
        )}
      >
        {expanded ? (
          <div className="relative flex-1 min-w-0 animate-in slide-in-from-right-4 fade-in duration-200">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people…"
              className="h-10 rounded-xl pl-9 pr-9 bg-card border-border shadow-sm"
              autoComplete="off"
              autoFocus
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
              onClick={() => {
                setExpanded(false);
                setQ("");
              }}
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-xl p-2.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Search people"
          >
            <Search className="h-5 w-5" />
          </button>
        )}
      </div>

      {expanded && (
        <>
          <button type="button" className="fixed inset-0 z-[38] sm:hidden" aria-label="Dismiss" onClick={() => setExpanded(false)} />
          <div className="fixed left-2 right-2 top-[calc(3.5rem+env(safe-area-inset-top))] z-[42] mx-auto max-w-lg rounded-2xl border border-border bg-card shadow-xl max-h-[min(60vh,22rem)] overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(22rem,calc(100vw-2rem))] animate-in fade-in zoom-in-95 duration-200">
            <div className="overflow-y-auto max-h-[min(60vh,22rem)] py-1">
              {loading && debounced.length >= 2 && <p className="px-4 py-3 text-xs text-muted-foreground">Searching…</p>}
              {!loading && debounced.length >= 2 && results.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No people found</p>
              )}
              <ul>
                {results.map((p) => (
                  <li key={p.user_id}>
                    <Link
                      to={`/u/${p.user_id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
                      onClick={() => {
                        setExpanded(false);
                        setQ("");
                      }}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback>{(p.name || "?")[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{p.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SearchBarInline;
