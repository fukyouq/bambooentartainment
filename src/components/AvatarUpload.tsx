import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { uploadSonkMedia } from "@/lib/sonk-media";

interface Props {
  userId: string;
  value: string;
  onChange: (url: string) => void;
  /** Also show the raw URL field (profile page); the guide keeps it hidden. */
  showUrlField?: boolean;
}

/** Upload a profile picture from the device, with a preview and an optional link field. */
export function AvatarUpload({ userId, value, onChange, showUrlField = true }: Props) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pick = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file.");
    setBusy(true);
    try {
      onChange(await uploadSonkMedia(userId, file, file.name));
      toast.success("Profile picture uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt="Your profile picture preview"
            className="h-14 w-14 rounded-full border-2 border-border object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ImagePlus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="min-h-11 rounded-full border-2 border-border px-4 text-sm font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {busy ? "Uploading…" : value ? "Change picture" : "Upload picture"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pick(file);
          }}
        />
      </div>
      {showUrlField && (
        <input
          aria-label="Profile picture URL"
          value={value}
          maxLength={500}
          placeholder="…or paste an image URL"
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 w-full rounded-sm border-2 border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}
    </div>
  );
}