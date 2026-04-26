import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserAvatar } from "./UserAvatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { Camera, Loader2, LogOut, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const schema = z.object({
  display_name: z.string().trim().min(2, "Name too short").max(50),
  bio: z.string().trim().max(200).optional().or(z.literal("")),
  class_name: z.string().trim().max(50).optional().or(z.literal("")),
  section: z.enum(["", "A", "B"]).optional(),
  status_message: z.string().trim().max(80).optional().or(z.literal("")),
});

export function ProfileDialog({ open, onOpenChange }: Props) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    setProfile(null);
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [open, user]);

  const isVerified = !!profile?.badges?.some((b: string) => b === "verified" || b === "admin");

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    setUploading(true);
    const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, f, { cacheControl: "3600", upsert: true, contentType: f.type });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("user_id", user.id);
    setUploading(false);
    if (updErr) {
      toast.error(updErr.message);
      return;
    }
    setProfile({ ...profile, avatar_url: url });
    toast.success("Profile photo updated");
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      display_name: fd.get("display_name"),
      bio: fd.get("bio") || "",
      class_name: fd.get("class_name") || "",
      section: (fd.get("section") as string) || "",
      status_message: fd.get("status_message") || "",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        bio: parsed.data.bio || null,
        class_name: parsed.data.class_name || null,
        section: parsed.data.section || null,
        status_message: parsed.data.status_message || null,
        privacy_show_online: profile.privacy_show_online,
        privacy_show_seen: profile.privacy_show_seen,
      })
      .eq("user_id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      onOpenChange(false);
    }
  };

  if (!profile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            Profile
            {isVerified && <VerifiedBadge size={18} />}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative"
              disabled={uploading}
              aria-label="Change profile photo"
            >
              <UserAvatar name={profile.display_name} url={profile.avatar_url} size={96} />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-primary underline-offset-2 hover:underline"
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Change photo"}
            </button>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="max-w-[220px] truncate">{user?.email}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name}
              required
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status_message">Status</Label>
            <Input
              id="status_message"
              name="status_message"
              defaultValue={profile.status_message || ""}
              maxLength={80}
              placeholder="e.g. Studying for boards 📚"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="class_name">Class</Label>
              <Input
                id="class_name"
                name="class_name"
                defaultValue={profile.class_name || ""}
                maxLength={50}
                placeholder="e.g. 12th"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="section">Section</Label>
              <select
                id="section"
                name="section"
                defaultValue={(profile.section || "").toUpperCase()}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">—</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              defaultValue={profile.bio || ""}
              maxLength={200}
              rows={3}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Show online status</div>
                <div className="text-xs text-muted-foreground">
                  Let others see when you're online
                </div>
              </div>
              <Switch
                checked={!!profile.privacy_show_online}
                onCheckedChange={(v) => setProfile({ ...profile, privacy_show_online: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Read receipts</div>
                <div className="text-xs text-muted-foreground">
                  Let others see when you've read their messages
                </div>
              </div>
              <Switch
                checked={!!profile.privacy_show_seen}
                onCheckedChange={(v) => setProfile({ ...profile, privacy_show_seen: v })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-brand text-primary-foreground"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-destructive hover:text-destructive"
              onClick={async () => {
                await signOut();
                onOpenChange(false);
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
