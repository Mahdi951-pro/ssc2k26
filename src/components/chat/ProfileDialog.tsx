import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserAvatar } from "./UserAvatar";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const schema = z.object({
  display_name: z.string().trim().min(2).max(50),
  bio: z.string().trim().max(200).optional().or(z.literal("")),
  class_name: z.string().trim().max(50).optional().or(z.literal("")),
  section: z.string().trim().max(20).optional().or(z.literal("")),
});

export function ProfileDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [open, user]);

  if (!profile) return null;

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      display_name: fd.get("display_name"),
      bio: fd.get("bio") || "",
      class_name: fd.get("class_name") || "",
      section: fd.get("section") || "",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        ...parsed.data,
        privacy_show_online: profile.privacy_show_online,
        privacy_show_seen: profile.privacy_show_seen,
      })
      .eq("user_id", user!.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Profile settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="flex justify-center">
            <UserAvatar name={profile.display_name} url={profile.avatar_url} size={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" name="display_name" defaultValue={profile.display_name} required maxLength={50} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="class_name">Class</Label>
              <Input id="class_name" name="class_name" defaultValue={profile.class_name || ""} maxLength={50} placeholder="e.g. 12th" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="section">Section</Label>
              <Input id="section" name="section" defaultValue={profile.section || ""} maxLength={20} placeholder="A" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" defaultValue={profile.bio || ""} maxLength={200} rows={3} />
          </div>
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Show online status</div>
                <div className="text-xs text-muted-foreground">Let others see when you're online</div>
              </div>
              <Switch
                checked={!!profile.privacy_show_online}
                onCheckedChange={(v) => setProfile({ ...profile, privacy_show_online: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Read receipts</div>
                <div className="text-xs text-muted-foreground">Let others see when you've read their messages</div>
              </div>
              <Switch
                checked={!!profile.privacy_show_seen}
                onCheckedChange={(v) => setProfile({ ...profile, privacy_show_seen: v })}
              />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-brand text-primary-foreground">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
