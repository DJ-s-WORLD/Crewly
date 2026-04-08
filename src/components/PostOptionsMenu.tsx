import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MoreVertical,
  Download,
  Share2,
  Pencil,
  Archive,
  Trash2,
  MessageCircle,
  Link2,
  Share,
  Send,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { PostWithMeta } from "@/services/posts";
import {
  deletePost,
  updatePostCaption,
  setPostArchived,
  updatePostFlags,
} from "@/services/posts";
import { listConversationPreviews, sendSocialMessage } from "@/services/social";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = {
  post: PostWithMeta;
  onPostUpdated: () => void;
  onPostDeleted?: () => void;
};

function postPublicUrl(postId: string) {
  return `${window.location.origin}/post/${postId}`;
}

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const PostOptionsMenu = ({ post, onPostUpdated, onPostDeleted }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(post.content || "");
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [previews, setPreviews] = useState<Awaited<ReturnType<typeof listConversationPreviews>>>([]);
  const isOwner = user?.id === post.user_id;
  const canViewerShare = isOwner || post.share_enabled !== false;
  const canViewerDownload = isOwner || post.download_enabled !== false;
  const showMenu = isOwner || canViewerShare || canViewerDownload;

  useEffect(() => {
    setEditText(post.content || "");
  }, [post.content, post.id]);

  const closeMenus = () => {
    setMenuOpen(false);
    setShareOpen(false);
  };

  const handleDownload = async () => {
    closeMenus();
    if (!post.image_url) {
      toast.error("This post has no image to download");
      return;
    }
    try {
      await downloadImage(post.image_url, `lifepilot-post-${post.id.slice(0, 8)}.jpg`);
      toast.success("Image saved");
    } catch {
      toast.error("Download failed — try opening the image in a new tab");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(postPublicUrl(post.id));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
    setShareOpen(false);
    closeMenus();
  };

  const shareNative = async () => {
    const url = postPublicUrl(post.id);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${post.profile?.name || "LifePilot"} post`,
          text: post.content?.slice(0, 120) || "Check out this post",
          url,
        });
      }
    } catch {
      await navigator.clipboard.writeText(postPublicUrl(post.id));
      toast.success("Link copied");
    }
    setShareOpen(false);
    closeMenus();
  };

  const openChatShare = async () => {
    setShareOpen(false);
    closeMenus();
    setChatOpen(true);
    setPreviews(await listConversationPreviews());
  };

  const sendToChat = async (conversationId: string) => {
    const url = postPublicUrl(post.id);
    const { error } = await sendSocialMessage(conversationId, `📎 Shared a post: ${url}`);
    if (error) {
      toast.error("Could not send");
      return;
    }
    toast.success("Sent to chat");
    setChatOpen(false);
    navigate(`/messages/${conversationId}`);
  };

  const saveEdit = async () => {
    setBusy(true);
    const hasImg = !!(post.image_url && post.image_url.trim());
    const { error } = await updatePostCaption(post.id, editText, hasImg);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Post updated");
    setEditOpen(false);
    onPostUpdated();
  };

  const doArchive = async () => {
    closeMenus();
    setBusy(true);
    const { error } = await setPostArchived(post.id, true);
    setBusy(false);
    if (error) {
      toast.error(error.message || "Could not archive");
      return;
    }
    toast.success("Post archived");
    onPostDeleted?.();
    onPostUpdated();
    navigate("/feed");
  };

  const doDelete = async () => {
    closeMenus();
    if (!confirm("Delete this post permanently?")) return;
    setBusy(true);
    const { error } = await deletePost(post.id);
    setBusy(false);
    if (error) {
      toast.error("Could not delete");
      return;
    }
    toast.success("Post deleted");
    onPostDeleted?.();
    navigate("/feed");
  };

  const toggleFlag = async (key: "comments_enabled" | "share_enabled" | "download_enabled") => {
    const cur =
      key === "comments_enabled"
        ? post.comments_enabled !== false
        : key === "share_enabled"
          ? post.share_enabled !== false
          : post.download_enabled !== false;
    const { error } = await updatePostFlags(post.id, { [key]: !cur });
    if (error) {
      toast.error(error.message || "Could not update");
      return;
    }
    toast.success("Updated");
    onPostUpdated();
  };

  if (!showMenu) return null;

  return (
    <>
      <div className="relative">
        <button
          type="button"
          disabled={busy}
          className="rounded-xl p-2 text-muted-foreground hover:bg-accent/70 hover:text-foreground transition-colors"
          aria-label="Post options"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {menuOpen && (
          <>
            <button type="button" className="fixed inset-0 z-[35]" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
            <div
              className={cn(
                "absolute right-0 top-full z-[45] mt-1 w-56 rounded-2xl border border-border bg-card py-1 shadow-xl",
                "animate-in fade-in zoom-in-95 duration-150 max-h-[70vh] overflow-y-auto"
              )}
            >
              {canViewerDownload && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent/60"
                  onClick={() => void handleDownload()}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  Download post
                </button>
              )}
              {canViewerShare && (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent/60"
                    onClick={() => {
                      setMenuOpen(false);
                      setShareOpen(true);
                    }}
                  >
                    <Share2 className="h-4 w-4 shrink-0" />
                    Share post
                  </button>
                </>
              )}
              {isOwner && (
                <>
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent/60"
                    onClick={() => {
                      setMenuOpen(false);
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 shrink-0" />
                    Edit post
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent/60"
                    onClick={() => void doArchive()}
                  >
                    <Archive className="h-4 w-4 shrink-0" />
                    Archive post
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent/60"
                    onClick={() => void toggleFlag("comments_enabled")}
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    {post.comments_enabled === false ? "Turn on comments" : "Turn off comments"}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent/60"
                    onClick={() => void toggleFlag("share_enabled")}
                  >
                    <Share2 className="h-4 w-4 shrink-0" />
                    {post.share_enabled === false ? "Turn on sharing" : "Turn off sharing"}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent/60"
                    onClick={() => void toggleFlag("download_enabled")}
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    {post.download_enabled === false ? "Turn on downloading" : "Turn off downloading"}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => void doDelete()}
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    Delete post
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {shareOpen && (
        <>
          <button type="button" className="fixed inset-0 z-[40]" onClick={() => setShareOpen(false)} aria-label="Close" />
          <div className="fixed left-1/2 top-1/2 z-[50] w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-2 shadow-2xl animate-in zoom-in-95">
            <p className="px-2 py-2 text-xs font-semibold text-muted-foreground">Share</p>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-accent/60"
              onClick={() => void openChatShare()}
            >
              <Send className="h-4 w-4" />
              Share to chat
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-accent/60"
              onClick={() => void copyLink()}
            >
              <Link2 className="h-4 w-4" />
              Copy link
            </button>
            {"share" in navigator && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-accent/60"
                onClick={() => void shareNative()}
              >
                <Share className="h-4 w-4" />
                Share…
              </button>
            )}
          </div>
        </>
      )}

      {editOpen && (
        <>
          <button type="button" className="fixed inset-0 z-[50] bg-black/50" onClick={() => setEditOpen(false)} aria-label="Close" />
          <div className="fixed left-1/2 top-1/2 z-[55] w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-4 shadow-2xl space-y-3">
            <p className="font-semibold text-sm">Edit caption</p>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full min-h-[110px] rounded-xl border border-input bg-background px-3 py-2 text-sm"
              maxLength={5000}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="rounded-xl" disabled={busy} onClick={() => void saveEdit()}>
                Save
              </Button>
            </div>
          </div>
        </>
      )}

      {chatOpen && (
        <>
          <button type="button" className="fixed inset-0 z-[55] bg-black/30" onClick={() => setChatOpen(false)} aria-label="Close" />
          <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[56] mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl max-h-[50vh] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Send to…</p>
              <button type="button" className="p-1 rounded-lg hover:bg-accent" onClick={() => setChatOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="overflow-y-auto space-y-1">
              {previews.length === 0 ? (
                <li className="text-sm text-muted-foreground py-4 text-center">No conversations yet.</li>
              ) : (
                previews.map((p) => (
                  <li key={p.conversationId}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-accent/50"
                      onClick={() => void sendToChat(p.conversationId)}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={p.otherUser?.avatar_url || undefined} />
                        <AvatarFallback>{(p.otherUser?.name || "?")[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate">{p.otherUser?.name || "Chat"}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </>
  );
};

export default PostOptionsMenu;
