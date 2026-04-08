import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import CameraCapture from "@/components/CameraCapture";
import ImagePreview from "@/components/ImagePreview";
import TextPostEditor from "@/components/TextPostEditor";

type Phase = "menu" | "camera" | "preview" | "text";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CreatePostModal = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("menu");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setPhase("menu");
      setImageFile(null);
    }
  }, [open]);

  const finishFlow = () => {
    setPhase("menu");
    setImageFile(null);
    onOpenChange(false);
    navigate("/feed");
  };

  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setImageFile(f);
    setPhase("preview");
  };

  if (!open) return null;

  if (phase === "camera") {
    return (
      <CameraCapture
        onCancel={() => setPhase("menu")}
        onCapture={(f) => {
          setImageFile(f);
          setPhase("preview");
        }}
      />
    );
  }

  if (phase === "preview" && imageFile) {
    return (
      <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-in fade-in duration-200">
        <ImagePreview
          imageFile={imageFile}
          onBack={() => {
            setImageFile(null);
            setPhase("menu");
          }}
          onPosted={finishFlow}
          excludeUserId={user?.id}
        />
      </div>
    );
  }

  if (phase === "text") {
    return (
      <div className="fixed inset-0 z-[55] flex flex-col bg-background animate-in fade-in duration-200">
        <TextPostEditor onBack={() => setPhase("menu")} onPosted={finishFlow} excludeUserId={user?.id} />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[54] bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-200"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[55] mx-auto max-w-lg rounded-t-3xl border border-border bg-card shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-labelledby="create-post-title"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <h2 id="create-post-title" className="text-center text-sm font-semibold text-foreground pt-3 pb-1">
          Create
        </h2>
        <p className="text-center text-[11px] text-muted-foreground px-6 pb-3">Share a moment with your crew</p>

        <ul className="px-3 pb-4 space-y-1">
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-accent/70 active:scale-[0.99]"
              onClick={() => setPhase("camera")}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-xl" aria-hidden>
                📷
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Camera</p>
                <p className="text-xs text-muted-foreground">Take a new photo</p>
              </div>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-accent/70 active:scale-[0.99]"
              onClick={() => galleryRef.current?.click()}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-xl" aria-hidden>
                🖼
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Gallery</p>
                <p className="text-xs text-muted-foreground">Choose from your library</p>
              </div>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-accent/70 active:scale-[0.99]"
              onClick={() => setPhase("text")}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-xl" aria-hidden>
                ✍️
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Write post</p>
                <p className="text-xs text-muted-foreground">Text only — like a status</p>
              </div>
            </button>
          </li>
        </ul>

        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onGalleryChange} />

        <div className="px-4 pb-2">
          <button
            type="button"
            className="w-full rounded-2xl py-3 text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

export default CreatePostModal;
