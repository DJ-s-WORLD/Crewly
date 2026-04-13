import { Archive, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { colorPresets, useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  email: string | undefined;
  joinedLabel: string;
  onSignOut: () => void | Promise<void>;
  onViewArchived?: () => void;
  privacyValue?: boolean;
  onTogglePrivacy?: (v: boolean) => void | Promise<void>;
};

const SettingsModal = ({ open, onClose, email, joinedLabel, onSignOut, onViewArchived, privacyValue, onTogglePrivacy }: Props) => {
  const { bgColor, setBgColor } = useTheme();

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-200"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[61] mx-auto max-w-lg rounded-t-3xl border border-border bg-card shadow-2xl",
          "pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto"
        )}
        role="dialog"
        aria-labelledby="settings-title"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <h2 id="settings-title" className="text-center text-base font-semibold pt-4 pb-1">
          Settings
        </h2>

        <div className="px-5 pt-2 pb-4 space-y-5">
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 space-y-3">
            <p className="text-sm text-foreground">
              <span className="mr-1.5" aria-hidden>
                📧
              </span>
              <span className="text-muted-foreground">Email:</span>{" "}
              <span className="font-medium break-all">{email || "—"}</span>
            </p>
            <p className="text-sm text-foreground">
              <span className="mr-1.5" aria-hidden>
                📅
              </span>
              <span className="text-muted-foreground">Joined:</span>{" "}
              <span className="font-medium">{joinedLabel || "—"}</span>
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
              <span aria-hidden>🎨</span>
              App Background / Theme
            </p>
            <p className="text-xs text-muted-foreground mb-3">Pick a backdrop tint for the app</p>
            <div className="-mx-1 px-2">
              <div
                className={cn(
                  "flex flex-nowrap gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-1 px-2 py-2",
                  "[scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent]",
                  "snap-x snap-mandatory"
                )}
              >
                {colorPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setBgColor(preset.bg)}
                    className={cn(
                      "flex shrink-0 snap-start flex-col items-center gap-1 rounded-xl p-2 min-w-[4.25rem] transition-all active:scale-95",
                      bgColor === preset.bg ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:bg-accent/60"
                    )}
                  >
                    <div
                      className="h-9 w-9 rounded-full border border-border shadow-inner shrink-0"
                      style={{ backgroundColor: preset.bg || "hsl(var(--muted))" }}
                    />
                    <span className="text-[9px] text-muted-foreground text-center leading-tight max-w-[4.5rem] truncate w-full">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {onViewArchived && (
            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-2xl h-12 gap-2 font-semibold border border-border/80 shadow-sm active:scale-[0.99] transition-transform"
              onClick={onViewArchived}
            >
              <Archive className="h-4 w-4 shrink-0" />
              View archived posts
            </Button>
          )}

          {(privacyValue !== undefined || onTogglePrivacy) && (
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Private Account
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Only followers can see your posts and full profile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onTogglePrivacy?.(!privacyValue)}
                  className={cn(
                    "h-8 w-14 rounded-full border border-border transition-colors relative shrink-0",
                    privacyValue ? "bg-primary" : "bg-background"
                  )}
                  aria-label="Toggle private account"
                >
                  <span
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white shadow",
                      privacyValue ? "left-7" : "left-1"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="destructive"
            className="w-full rounded-2xl h-12 gap-2 font-semibold shadow-sm active:scale-[0.99] transition-transform"
            onClick={() => void onSignOut()}
          >
            <span className="mr-1" aria-hidden>
              <LogOut className="h-4 w-4 shrink-0" />
            </span>
            Sign Out
          </Button>
        </div>
      </div>
    </>
  );
};

export default SettingsModal;
