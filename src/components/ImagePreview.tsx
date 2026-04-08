import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import TagUserInput from "@/components/TagUserInput";
import { createPost } from "@/services/posts";
import type { PublicProfile } from "@/services/social";
import { toast } from "sonner";

type Props = {
  imageFile: File;
  onBack: () => void;
  onPosted: () => void;
  excludeUserId?: string;
};

const ImagePreview = ({ imageFile, onBack, onPosted, excludeUserId }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [tagged, setTagged] = useState<PublicProfile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(imageFile);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [imageFile]);

  const submit = async () => {
    const trimmed = caption.trim();
    setUploadError(null);
    setSubmitting(true);
    const { error } = await createPost({
      content: trimmed,
      imageFile,
      taggedUserIds: tagged.map((t) => t.user_id),
    });
    setSubmitting(false);
    if (error) {
      const msg = error.message || "Could not post";
      setUploadError(msg);
      toast.error(msg);
      return;
    }
    toast.success("Posted!");
    onPosted();
  };

  return (
    <div className="flex flex-col h-full min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 shrink-0">
        <Button type="button" variant="ghost" size="icon" className="rounded-full shrink-0" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-sm font-semibold flex-1">New post</h2>
        <Button
          type="button"
          size="sm"
          className="rounded-full px-4"
          disabled={submitting}
          onClick={() => void submit()}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {url && (
          <div className="w-full animate-in fade-in duration-500">
            <img src={url} alt="" className="w-full max-h-[42vh] object-cover bg-muted" />
          </div>
        )}
        <div className="p-4 space-y-3">
          <TagUserInput
            value={caption}
            onChange={setCaption}
            tagged={tagged}
            onTaggedChange={setTagged}
            excludeUserId={excludeUserId}
            placeholder="Write a caption… @ to tag"
            minRows={3}
            disabled={submitting}
          />
          {uploadError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive space-y-2">
              <p>{uploadError}</p>
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-full" onClick={() => void submit()}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImagePreview;
