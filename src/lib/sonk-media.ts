import { supabase } from "@/integrations/supabase/client";

const BUCKET = "sonk-media";
/** Roughly ten years — long enough that stored links keep working. */
const LINK_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** Uploads a file (picked or recorded) to the private media bucket and returns a playable URL. */
export async function uploadSonkMedia(
  userId: string,
  file: Blob,
  filename: string,
): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 200MB");
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, LINK_TTL_SECONDS);
  if (signError || !data) throw signError ?? new Error("Could not create a media link");
  return data.signedUrl;
}

export function extensionFor(mime: string) {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime")) return "mov";
  return "webm";
}