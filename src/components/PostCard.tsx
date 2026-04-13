import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LikeButton from "@/components/LikeButton";
import CommentSection from "@/components/CommentSection";
import PostOptionsMenu from "@/components/PostOptionsMenu";
import FollowButton from "@/components/FollowButton";
import type { PostWithMeta } from "@/services/posts";
import { cn } from "@/lib/utils";
import { renderCaptionHighlights } from "@/components/TagUserInput";
import { useAuth } from "@/context/AuthContext";

type Props = {
  post: PostWithMeta;
  /** Show inline comments (detail page). */
  expandComments?: boolean;
  /** Feed / discovery: show follow control for other users’ posts. */
  showAuthorFollow?: boolean;
  onPostUpdated?: () => void;
  onPostRemoved?: () => void;
};

const PostCard = ({ post, expandComments = false, showAuthorFollow = false, onPostUpdated, onPostRemoved }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [commentBump, setCommentBump] = useState(0);
  const commentsOk = post.comments_enabled !== false;

  const textOnly = !post.image_url;
  const caption = (post.content || "").trim();
  const showFollow = showAuthorFollow && !!user?.id && post.user_id !== user.id;

  return (
    <article
      className={cn(
        "rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md animate-in fade-in duration-300",
        textOnly
          ? "border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.07]"
          : "border-border/60 bg-card"
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Link to={`/u/${post.user_id}`} className="shrink-0">
          <Avatar className="h-10 w-10 ring-2 ring-background">
            <AvatarImage src={post.profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/15 text-primary font-bold">
              {(post.profile?.name || "?")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${post.user_id}`} className="font-semibold text-foreground text-sm truncate block hover:underline">
            {post.profile?.name || "Member"}
          </Link>
          <p className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
        {showFollow ? (
          <FollowButton targetUserId={post.user_id} isPrivate={!!post.profile?.is_private} size="sm" />
        ) : null}
        <PostOptionsMenu
          post={post}
          onPostUpdated={() => onPostUpdated?.()}
          onPostDeleted={() => onPostRemoved?.()}
        />
      </div>

      {post.image_url && (
        <button
          type="button"
          className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => navigate(`/post/${post.id}`)}
        >
          <img src={post.image_url} alt="" className="w-full max-h-[min(420px,70vh)] object-cover bg-muted" loading="lazy" />
        </button>
      )}

      {caption && (
        <div className={cn("px-4 py-3", textOnly && "pt-1")}>
          <p className={cn("text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed", textOnly && "text-base")}>
            {post.taggedUsers?.length ? renderCaptionHighlights(caption, post.taggedUsers) : caption}
          </p>
        </div>
      )}

      {post.taggedUsers && post.taggedUsers.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">With</span>
          <div className="flex flex-wrap gap-1.5">
            {post.taggedUsers.map((u) => (
              <Link
                key={u.user_id}
                to={`/u/${u.user_id}`}
                className="inline-flex items-center gap-1 rounded-full bg-muted/80 pl-1 pr-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px]">{u.name[0]}</AvatarFallback>
                </Avatar>
                {u.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-0.5 px-2 pb-2 pt-1 border-t border-border/40">
        <LikeButton postId={post.id} initialLiked={post.likedByMe} initialCount={post.likeCount} />
        {commentsOk ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60"
            onClick={() => navigate(`/post/${post.id}`)}
          >
            <MessageCircle className="h-5 w-5" />
            <span>{post.commentCount + commentBump}</span>
          </button>
        ) : (
          <div
            className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-medium text-muted-foreground/35 cursor-not-allowed select-none"
            aria-disabled="true"
            title="Comments are turned off"
          >
            <MessageCircle className="h-5 w-5 opacity-40" />
            <span className="tabular-nums opacity-40">{post.commentCount + commentBump}</span>
          </div>
        )}
      </div>

      {expandComments && (
        <div className="px-4 pb-4 pt-0 border-t border-border/30">
          <CommentSection
            postId={post.id}
            commentsEnabled={commentsOk}
            onCommentAdded={() => setCommentBump((b) => b + 1)}
          />
        </div>
      )}
    </article>
  );
};

export default PostCard;
