import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { togglePostLike } from "@/services/posts";
import { toast } from "sonner";

type Props = {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  size?: "sm" | "md";
};

const LikeButton = ({ postId, initialLiked, initialCount, size = "md" }: Props) => {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  const onToggle = async () => {
    const nextLiked = !liked;
    const nextCount = count + (nextLiked ? 1 : -1);
    setLiked(nextLiked);
    setCount(Math.max(0, nextCount));
    const { error } = await togglePostLike(postId, !nextLiked);
    if (error) {
      setLiked(!nextLiked);
      setCount(count);
      toast.error("Could not update like");
    }
  };

  const iconClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={() => void onToggle()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-medium transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-accent/60",
        liked && "text-red-500"
      )}
      aria-label={liked ? "Unlike" : "Like"}
    >
      <Heart className={cn(iconClass, liked && "fill-current scale-110")} />
      <span>{count}</span>
    </button>
  );
};

export default LikeButton;
