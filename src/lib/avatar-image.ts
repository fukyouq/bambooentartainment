/** Client-side validation and safe re-encoding for profile pictures. */

export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_DIMENSION = 1024;

export interface ProcessedAvatar {
  blob: Blob;
  filename: string;
}

/**
 * Validates type and size, decodes the file to prove it is a real image, then
 * re-encodes it to a bounded JPEG. Re-encoding strips metadata (EXIF, embedded
 * payloads) so only pixel data is ever uploaded.
 */
export async function processAvatarFile(file: File): Promise<ProcessedAvatar> {
  if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP or GIF image.");
  }
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error(`Images must be 5MB or smaller (yours is ${(file.size / 1048576).toFixed(1)}MB).`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file is not a readable image.");
  }

  const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("Could not process that image.");
  if (blob.size > AVATAR_MAX_BYTES) throw new Error("Processed image is still too large.");

  return { blob, filename: "avatar.jpg" };
}
