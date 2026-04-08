import type { RefObject } from "react";
import { Camera, Edit2, Check, Share2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProfileStats from "@/components/ProfileStats";
import { cn } from "@/lib/utils";

type Props = {
  avatarUrl: string;
  name: string;
  editingName: boolean;
  nameInput: string;
  onNameInputChange: (v: string) => void;
  onStartEditName: () => void;
  onSaveName: () => void;
  postsCount: number;
  followers: number;
  following: number;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
  /** Shown as a single-line bio when set (e.g. mood status). */
  bioLine?: string | null;
  onShare: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const ProfileCard = ({
  avatarUrl,
  name,
  editingName,
  nameInput,
  onNameInputChange,
  onStartEditName,
  onSaveName,
  postsCount,
  followers,
  following,
  onFollowersClick,
  onFollowingClick,
  bioLine,
  onShare,
  fileInputRef,
  onAvatarChange,
}: Props) => {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border/60 bg-card/80 p-6 pt-8 pb-8 shadow-lg shadow-black/5",
        "backdrop-blur-sm transition-shadow hover:shadow-xl hover:shadow-black/[0.07]"
      )}
    >
      <button
        type="button"
        onClick={onShare}
        className={cn(
          "absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-md shadow-primary/25",
          "border border-primary/20 transition-transform active:scale-95 hover:brightness-110"
        )}
        aria-label="Share profile poster"
      >
        <Share2 className="h-5 w-5" />
      </button>

      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <Avatar className="h-28 w-28 ring-4 ring-background shadow-xl">
            <AvatarImage src={avatarUrl || undefined} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-3xl font-bold">
              {name ? name[0].toUpperCase() : <UserIcon className="h-12 w-12 opacity-60" />}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg border-2 border-background transition-transform active:scale-95"
            aria-label="Change profile photo"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
        </div>

        <ProfileStats
          posts={postsCount}
          followers={followers}
          following={following}
          className="mt-8"
          onFollowersClick={onFollowersClick}
          onFollowingClick={onFollowingClick}
        />

        <div className="mt-6 w-full max-w-sm space-y-2">
          {editingName ? (
            <div className="flex items-center gap-2 justify-center">
              <Input
                value={nameInput}
                onChange={(e) => onNameInputChange(e.target.value)}
                placeholder="Your name"
                className="rounded-xl text-center max-w-[220px]"
                autoFocus
              />
              <Button size="icon" variant="default" className="rounded-xl shrink-0" onClick={onSaveName} aria-label="Save name">
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-bold text-foreground tracking-tight">{name || "User"}</h2>
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

          {bioLine ? <p className="text-sm text-muted-foreground leading-relaxed px-2">{bioLine}</p> : null}
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;
