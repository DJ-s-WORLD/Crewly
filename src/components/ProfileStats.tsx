import { cn } from "@/lib/utils";

type Props = {
  posts: number;
  followers: number;
  following: number;
  className?: string;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
};

const ProfileStats = ({
  posts,
  followers,
  following,
  className,
  onFollowersClick,
  onFollowingClick,
}: Props) => {
  const postsCell = (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-background/60 py-3 px-1 border border-border/40 shadow-sm">
      <span className="text-lg font-bold tabular-nums text-foreground">{posts}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mt-0.5">Posts</span>
    </div>
  );

  const followersCell = (
    <button
      type="button"
      onClick={onFollowersClick}
      disabled={!onFollowersClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl bg-background/60 py-3 px-1 border border-border/40 shadow-sm w-full transition-colors",
        onFollowersClick && "hover:bg-accent/40 active:scale-[0.98] cursor-pointer",
        !onFollowersClick && "cursor-default"
      )}
    >
      <span className="text-lg font-bold tabular-nums text-foreground">{followers}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mt-0.5">Followers</span>
    </button>
  );

  const followingCell = (
    <button
      type="button"
      onClick={onFollowingClick}
      disabled={!onFollowingClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl bg-background/60 py-3 px-1 border border-border/40 shadow-sm w-full transition-colors",
        onFollowingClick && "hover:bg-accent/40 active:scale-[0.98] cursor-pointer",
        !onFollowingClick && "cursor-default"
      )}
    >
      <span className="text-lg font-bold tabular-nums text-foreground">{following}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mt-0.5">Following</span>
    </button>
  );

  return (
    <div className={cn("grid grid-cols-3 gap-2 w-full max-w-xs mx-auto", className)}>
      {postsCell}
      {followersCell}
      {followingCell}
    </div>
  );
};

export default ProfileStats;
