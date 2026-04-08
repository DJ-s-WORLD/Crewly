import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import TagUserInput from "@/components/TagUserInput";
import { createPost } from "@/services/posts";
import type { PublicProfile } from "@/services/social";
import { toast } from "sonner";

type Props = {
  onBack: () => void;
  onPosted: () => void;
  excludeUserId?: string;
};

const TextPostEditor = ({ onBack, onPosted, excludeUserId }: Props) => {
  const [text, setText] = useState("");
  const [tagged, setTagged] = useState<PublicProfile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Write something first");
      return;
    }
    setUploadError(null);
    setSubmitting(true);
    const { error } = await createPost({
      content: trimmed,
      imageFile: null,
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
        <h2 className="text-sm font-semibold flex-1">Write post</h2>
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

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <TagUserInput
          value={text}
          onChange={setText}
          tagged={tagged}
          onTaggedChange={setTagged}
          excludeUserId={excludeUserId}
          placeholder="What's on your mind?"
          minRows={10}
          disabled={submitting}
          className="min-h-[40vh]"
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
  );
};

export default TextPostEditor;
