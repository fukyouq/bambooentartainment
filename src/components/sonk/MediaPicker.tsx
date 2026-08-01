import { useEffect, useRef, useState } from "react";
import { Circle, Square, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { extensionFor, uploadSonkMedia } from "@/lib/sonk-media";

interface Props {
  userId: string;
  /** Label for the field, e.g. "Short video" or "Long-form video". */
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** Show the in-app camera recorder (used for shorts and news clips). */
  allowRecording?: boolean;
  accept?: string;
}

/** Upload a file, record in-app, or paste a link — used by every Sonk composer. */
export function MediaPicker({
  userId,
  label,
  value,
  onChange,
  allowRecording = false,
  accept = "video/*",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const send = async (blob: Blob, filename: string) => {
    setBusy(true);
    try {
      onChange(await uploadSonkMedia(userId, blob, filename));
      toast.success("Upload complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        void send(blob, `recording.${extensionFor(type)}`);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Camera access was blocked");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const fieldId = `media-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const focus =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div className="space-y-2">
      <span className="block text-xs font-bold uppercase">{label}</span>
      <div className="flex flex-wrap gap-2">
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border-2 border-border px-3 text-sm font-bold focus-within:ring-2 focus-within:ring-ring`}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {busy ? "Uploading…" : "Upload file"}
          <input
            type="file"
            accept={accept}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void send(file, file.name);
            }}
          />
        </label>
        {allowRecording &&
          (recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className={`inline-flex min-h-11 items-center gap-2 rounded-sm bg-news-red px-3 text-sm font-bold text-news-red-foreground ${focus}`}
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              Stop recording
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={busy}
              className={`inline-flex min-h-11 items-center gap-2 rounded-sm border-2 border-news-red px-3 text-sm font-bold text-news-red disabled:opacity-60 ${focus}`}
            >
              <Circle className="h-4 w-4" aria-hidden="true" />
              Record in app
            </button>
          ))}
      </div>
      {recording && (
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview"
          className="max-h-64 w-full border-2 border-news-red bg-foreground"
        />
      )}
      <label className="block text-xs font-bold uppercase text-muted-foreground" htmlFor={fieldId}>
        …or paste a link
      </label>
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className={`min-h-11 w-full rounded-sm border-2 border-border bg-background px-3 text-sm ${focus}`}
        />
      </div>
    </div>
  );
}