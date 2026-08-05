import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/AvatarUpload";

export function ProfileGuide() {
  const { user, profile, refreshProfile } = useAuth();
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user || !profile) return null;
  if (profile.bio && profile.avatar_url) return null;

  const save = async () => {
    if (!bio.trim() || !avatar.trim()) {
      toast.error("Add a bio and upload a profile picture.");
      return;
    }
    setSaving(true);
    const values = { bio: bio.trim().slice(0, 500), avatar_url: avatar.trim().slice(0, 500) };
    // A database trigger mirrors these fields into public_profiles, which powers
    // avatars/bios in Sonk feeds and article comments.
    const { error } = await supabase.from("profiles").update(values).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile completed!");
  };

  return (
    <div className="mb-8 rounded-lg border-2 border-dashed border-ember bg-ember/10 p-5">
      <h3 className="font-typewriter text-lg font-bold">Finish your profile</h3>
      <p className="mt-1 text-sm text-foreground/70">
        Add a bio and a profile picture — this guide disappears once both are saved.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-guide-bio" className="text-xs font-bold uppercase tracking-wide">
            Your bio
          </label>
          <Textarea
            id="profile-guide-bio"
            placeholder="Your bio"
            value={bio}
            maxLength={500}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-3">
          <AvatarUpload userId={user.id} value={avatar} onChange={setAvatar} showUrlField={false} />
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}