import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { ImagePlus, Loader2, Type, Globe, Users } from "lucide-react";

const BACKGROUNDS = [
  "linear-gradient(135deg, #6366f1, #ec4899)",
  "linear-gradient(135deg, #10b981, #06b6d4)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #3b82f6)",
  "linear-gradient(135deg, #14b8a6, #84cc16)",
  "linear-gradient(135deg, #1e293b, #475569)",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPosted: () => void;
}

export function StoryComposer({ open, onOpenChange, onPosted }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<"text" | "image">("text");
  const [content, setContent] = useState("");
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "section">("public");
  const [busy, setBusy] = useState(false);

  const onPickFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (f) setMode("image");
  };

  const reset = () => {
    setContent("");
    setFile(null);
    setPreview(null);
    setMode("text");
    setVisibility("public");
  };

  const submit = async () => {
    if (!user) return;
    if (mode === "text" && !content.trim()) {
      toast.error("Write something first");
      return;
    }
    if (mode === "image" && !file) {
      toast.error("Pick an image first");
      return;
    }
    setBusy(true);
    try {
      let media_url: string | null = null;
      if (mode === "image" && file) {
        const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("stories").upload(path, file);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("stories").getPublicUrl(path);
        media_url = data.publicUrl;
      }

      // Get user's section if they want section visibility
      let section: string | null = null;
      if (visibility === "section") {
        const { data: prof } = await supabase
          .from("profiles")
          .select("section")
          .eq("user_id", user.id)
          .maybeSingle();
        section = prof?.section ?? null;
        if (!section) {
          toast.error("Set your section in your profile to use section privacy");
          setBusy(false);
          return;
        }
      }

      const { error } = await supabase.from("stories").insert({
        author_id: user.id,
        type: mode,
        content: mode === "text" ? content.trim() : content.trim() || null,
        media_url,
        background: mode === "text" ? bg : null,
        visibility,
        section,
      });
      if (error) throw error;
      toast.success("Story posted! Disappears in 24h.");
      reset();
      onOpenChange(false);
      onPosted();
    } catch (e: any) {
      toast.error(e.message || "Could not post story");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share a story</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "text" ? "default" : "outline"}
            onClick={() => { setMode("text"); setFile(null); setPreview(null); }}
            className={mode === "text" ? "bg-gradient-brand text-primary-foreground" : ""}
          >
            <Type className="mr-1 h-3.5 w-3.5" /> Text
          </Button>
          <label>
            <Button
              type="button"
              size="sm"
              variant={mode === "image" ? "default" : "outline"}
              asChild
              className={mode === "image" ? "bg-gradient-brand text-primary-foreground" : ""}
            >
              <span><ImagePlus className="mr-1 h-3.5 w-3.5 inline" /> Image</span>
            </Button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {mode === "text" ? (
          <div
            className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl p-6 text-center"
            style={{ background: bg }}
          >
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={280}
              className="resize-none border-0 bg-transparent text-center text-xl font-semibold text-white placeholder:text-white/70 focus-visible:ring-0"
              rows={5}
            />
          </div>
        ) : (
          <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted">
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                Pick an image
              </div>
            )}
          </div>
        )}

        {mode === "text" && (
          <div className="flex flex-wrap gap-2">
            {BACKGROUNDS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setBg(g)}
                className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition ${bg === g ? "ring-primary" : "ring-transparent"}`}
                style={{ background: g }}
                aria-label="Background"
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Visibility:</span>
          <Button
            type="button"
            size="sm"
            variant={visibility === "public" ? "default" : "outline"}
            onClick={() => setVisibility("public")}
            className={`h-7 ${visibility === "public" ? "bg-gradient-brand text-primary-foreground" : ""}`}
          >
            <Globe className="mr-1 h-3 w-3" /> Everyone
          </Button>
          <Button
            type="button"
            size="sm"
            variant={visibility === "section" ? "default" : "outline"}
            onClick={() => setVisibility("section")}
            className={`h-7 ${visibility === "section" ? "bg-gradient-brand text-primary-foreground" : ""}`}
          >
            <Users className="mr-1 h-3 w-3" /> My section only
          </Button>
        </div>

        <Button
          onClick={submit}
          disabled={busy}
          className="w-full bg-gradient-brand text-primary-foreground"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share story"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
