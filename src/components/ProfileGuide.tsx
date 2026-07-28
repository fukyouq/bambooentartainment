import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function ProfileGuide() {
  const { user, profile, refreshProfile } = useAuth();
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user || !profile) return null;
  if (profile.bio && profile.avatar_url) return null;

  const save = async () => {
    if (!bio.trim() || !avatar.trim()) {
      toast.error("Add both a bio and a profile picture link.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bio.trim().slice(0, 500), avatar_url: avatar.trim().slice(0, 500) })
      .eq("id", user.id);
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
        <Textarea
          placeholder="Your bio"
          value={bio}
          maxLength={500}
          onChange={(e) => setBio(e.target.value)}
        />
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Profile picture URL"
            value={avatar}
            maxLength={500}
            onChange={(e) => setAvatar(e.target.value)}
          />
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}