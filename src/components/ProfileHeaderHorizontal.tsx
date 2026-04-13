import type { RefObject } from "react";
import { Camera, Edit2, Check, Share2, User as UserIcon, Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import UIDDisplay from "@/components/UIDDisplay";

type Props = {
  avatarUrl: string;
  username: string;
  uid?: number | null;
  isPrivate?: boolean;
  editingName: boolean;
  nameInput: string;
  onNameInputChange: (v: string) => void;
  onStartEditName: () => void;
  onSaveName: () => void;
  onShare?: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  postsCount: number;
  followers: number;
  following: number;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
  bioLine?: string | null;
};

const Stat = ({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) => {
  const clickable = !!onClick;
  const Comp: any = clickable ? "button" : "div";
  return (
    <Comp
      type={clickable ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-xl px-2.5 py-2 border border-border/50 bg-background/60 shadow-sm min-w-[4.75rem]",
        clickable && "hover:bg-accent/40 active:scale-[0.99] transition",
        !clickable && "cursor-default"
      )}
      aria-label={clickable ? label : undefined}
    >
      <span className="text-lg font-extrabold tabular-nums text-foreground leading-none">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-1 leading-none">
        {label}
      </span>
    </Comp>
  );
};

const ProfileHeaderHorizontal = ({
  avatarUrl,
  username,
  uid,
  isPrivate,
  editingName,
  nameInput,
  onNameInputChange,
  onStartEditName,
  onSaveName,
  onShare,
  fileInputRef,
  onAvatarChange,
  postsCount,
  followers,
  following,
  onFollowersClick,
  onFollowingClick,
  bioLine,
}: Props) => {
  return (
    <section
      className={cn(
        "relative rounded-2xl bg-card/80 p-3",
        
      )}
    >
      {onShare ? (
        <button
          type="button"
          onClick={onShare}
          className={cn(
            "absolute right-3 top-40 z-10 flex h-7 w-10 items-center justify-center rounded-full -translate-y-1/2",
            "bg-primary text-primary-foreground shadow-md shadow-primary/25",
            "border border-primary/20 transition-transform active:scale-95 hover:brightness-110"
          )}
          aria-label="Share profile"
        >
          <Share2 className="h-4 w-4" />
        </button>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar className="h-20 w-20 ring-2 ring-background shadow-lg">
            <AvatarImage src={avatarUrl || undefined} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-2xl font-bold">
              {username ? username[0].toUpperCase() : <UserIcon className="h-8 w-8 opacity-60" />}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg border-2 border-background transition-transform active:scale-95"
            aria-label="Change profile photo"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-end sm:justify-start">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-3 [scrollbar-width:thin]">
              <Stat label="Posts" value={postsCount} />
              <Stat label="Followers" value={followers} onClick={onFollowersClick} />
              <Stat label="Following" value={following} onClick={onFollowingClick} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input
              value={nameInput}
              onChange={(e) => onNameInputChange(e.target.value)}
              placeholder="Your name"
              className="rounded-xl max-w-[16rem]"
              autoFocus
            />
            <Button size="icon" variant="default" className="rounded-xl shrink-0" onClick={onSaveName} aria-label="Save name">
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground tracking-tight truncate">{username || "User"}</h2>
            {isPrivate ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <Lock className="h-3 w-3" />
                Private
              </span>
            ) : null}
            <button
              type="button"
              onClick={onStartEditName}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-accent/80 transition-colors"
              aria-label="Edit name"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        )}

        <UIDDisplay uid={uid} />

        {bioLine ? <p className="text-sm text-muted-foreground leading-relaxed">{bioLine}</p> : null}
      </div>
    </section>
  );
};

export default ProfileHeaderHorizontal;

