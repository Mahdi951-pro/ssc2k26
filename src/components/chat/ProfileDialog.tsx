import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserAvatar } from "./UserAvatar";
import { VerifiedBadge } from "./VerifiedBadge";
import {
  Camera,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const schema = z.object({
  display_name: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
  username: z.string().trim().min(2).max(30).regex(/^[a-z0-9_.]+$/i, "Letters, numbers, _ . only").optional().or(z.literal("")),
  bio: z.string().trim().max(200).optional().or(z.literal("")),
  class_name: z.string().trim().max(50).optional().or(z.literal("")),
  section: z.enum(["", "A", "B"]).optional(),
  status_message: z.string().trim().max(80).optional().or(z.literal("")),
});

const STATUS_PRESETS = [
  "📚 Studying for boards",
  "💤 Sleeping",
  "🎮 Gaming",
  "📝 Doing homework",
  "🏏 At practice",
  "🌙 Do not disturb",
  "🚀 Available",
];

export function ProfileDialog({ open, onOpenChange }: Props) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwShow, setPwShow] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
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
  const isAdmin = !!profile?.badges?.some((b: string) => b === "admin");

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
      username: fd.get("username") || "",
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
        username: parsed.data.username || null,
        bio: parsed.data.bio || null,
        class_name: parsed.data.class_name || null,
        section: parsed.data.section || null,
        status_message: parsed.data.status_message || null,
        privacy_show_online: profile.privacy_show_online,
        privacy_show_seen: profile.privacy_show_seen,
      })
      .eq("user_id", user.id);
    setBusy(false);
    if (error) {
      if (error.code === "23505") toast.error("That username is already taken");
      else toast.error(error.message);
    } else {
      toast.success("Profile saved ✨");
      onOpenChange(false);
    }
  };

  const updatePassword = async () => {
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      setPw("");
      setPwOpen(false);
    }
  };

  if (!profile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0">
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-md flex-col overflow-hidden border-border/60 bg-background/80 p-0 backdrop-blur-2xl sm:w-full">
        {/* Premium header / cover */}
        <div className="relative shrink-0">
          <div className="h-32 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.6),transparent_60%),radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.55),transparent_55%),linear-gradient(135deg,hsl(var(--primary)/0.35),hsl(var(--accent)/0.35))]">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><circle cx=%221%22 cy=%221%22 r=%221%22 fill=%22white%22 fill-opacity=%220.08%22/></svg>')] opacity-60" />
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Avatar */}
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative rounded-full ring-4 ring-background"
              disabled={uploading}
              aria-label="Change profile photo"
            >
              <UserAvatar name={profile.display_name} url={profile.avatar_url} size={104} />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg ring-2 ring-background">
                <Pencil className="h-3.5 w-3.5" />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-16">
          {/* Identity */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-xl font-bold tracking-tight">{profile.display_name}</h2>
              {isVerified && <VerifiedBadge size={20} />}
            </div>
            {profile.username && (
              <p className="mt-0.5 text-sm text-muted-foreground">@{profile.username}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              {isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </span>
              )}
              {profile.section && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Section {profile.section}
                </span>
              )}
              {profile.class_name && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {profile.class_name}
                </span>
              )}
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="max-w-[260px] truncate">{user?.email}</span>
            </div>
          </div>

          <form onSubmit={save} className="mt-5 space-y-4">
            {/* Status — quick edit */}
            <div className="rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </Label>
                <button
                  type="button"
                  onClick={() => setEditingStatus((v) => !v)}
                  className="text-xs text-primary hover:underline"
                >
                  {editingStatus ? "Done" : "Edit"}
                </button>
              </div>
              <Input
                id="status_message"
                name="status_message"
                defaultValue={profile.status_message || ""}
                maxLength={80}
                placeholder="What's on your mind?"
                className="border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
              />
              {editingStatus && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STATUS_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        const el = document.getElementById("status_message") as HTMLInputElement;
                        if (el) el.value = s;
                      }}
                      className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] transition hover:border-primary hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Identity edits */}
            <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="display_name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Display name
                </Label>
                <Input
                  id="display_name"
                  name="display_name"
                  defaultValue={profile.display_name}
                  required
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Username
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                  <Input
                    id="username"
                    name="username"
                    defaultValue={profile.username || ""}
                    maxLength={30}
                    className="pl-7"
                    placeholder="your_handle"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  name="bio"
                  defaultValue={profile.bio || ""}
                  maxLength={200}
                  rows={3}
                  placeholder="A short intro about you…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="class_name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Class
                  </Label>
                  <Input
                    id="class_name"
                    name="class_name"
                    defaultValue={profile.class_name || ""}
                    maxLength={50}
                    placeholder="e.g. 12th"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="section" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Section
                  </Label>
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
            </div>

            {/* Privacy */}
            <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Privacy
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Online status</div>
                    <div className="text-xs text-muted-foreground">Show when you're online</div>
                  </div>
                </div>
                <Switch
                  checked={!!profile.privacy_show_online}
                  onCheckedChange={(v) => setProfile({ ...profile, privacy_show_online: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Read receipts</div>
                    <div className="text-xs text-muted-foreground">Show when you've read messages</div>
                  </div>
                </div>
                <Switch
                  checked={!!profile.privacy_show_seen}
                  onCheckedChange={(v) => setProfile({ ...profile, privacy_show_seen: v })}
                />
              </div>
            </div>

            {/* Account */}
            <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Account
              </div>
              {!pwOpen ? (
                <button
                  type="button"
                  onClick={() => setPwOpen(true)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm transition hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    Change password
                  </span>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type={pwShow ? "text" : "password"}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      placeholder="New password (min 8 characters)"
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setPwShow((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {pwShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={updatePassword}
                      disabled={pwBusy}
                      className="flex-1"
                    >
                      {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" /> Update</>}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setPwOpen(false); setPw(""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="submit"
                disabled={busy}
                className="h-11 w-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25 transition hover:shadow-primary/40"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Save changes
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
