import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, SwitchCamera } from "lucide-react";

type Props = {
  onCapture: (file: File) => void;
  onCancel: () => void;
};

const CameraCapture = ({ onCapture, onCancel }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
      } catch {
        setError(
          "Camera access was denied or unavailable. Allow camera in your browser settings, or choose a photo from your gallery instead."
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const snap = () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background animate-in fade-in duration-200">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={onCancel} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-sm font-semibold flex-1 text-center pr-10">Camera</h2>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center bg-black/90 min-h-0 p-4">
        {error ? (
          <div className="max-w-sm text-center space-y-4 px-4">
            <p className="text-sm text-primary-foreground/90 leading-relaxed">{error}</p>
            <Button type="button" variant="secondary" className="rounded-full" onClick={onCancel}>
              Go back
            </Button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full max-w-lg rounded-2xl bg-black object-cover max-h-[55vh] shadow-2xl" playsInline muted />
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                aria-label="Flip camera"
              >
                <SwitchCamera className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-16 w-16 rounded-full shadow-lg active:scale-95 transition-transform"
                onClick={snap}
                aria-label="Take photo"
              >
                <Camera className="h-7 w-7" />
              </Button>
              <span className="w-12" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraCapture;
