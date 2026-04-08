import imageCompression from "browser-image-compression";

const MAX_MB = 0.95; // ~1MB target

/**
 * Compress images client-side before upload (JPEG, max dimension 1920).
 */
export async function compressImageFile(file: File | Blob, maxBytes = 1_000_000): Promise<Blob> {
  const input =
    file instanceof File
      ? file
      : new File([file], "photo.jpg", { type: file.type || "image/jpeg" });

  const maxSizeMB = Math.min(MAX_MB, maxBytes / (1024 * 1024));

  const options = {
    maxSizeMB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.85,
  };

  let out = await imageCompression(input, options);
  if (out.size > maxBytes) {
    out = await imageCompression(out, {
      ...options,
      maxSizeMB: maxSizeMB * 0.75,
      initialQuality: 0.72,
    });
  }
  if (out.size > maxBytes) {
    throw new Error("Image is still too large after compression. Try a smaller photo.");
  }
  return out;
}
