import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check } from "lucide-react";

const WALLPAPERS: { id: string; label: string; css: string }[] = [
  { id: "default", label: "Default", css: "" },
  {
    id: "aurora",
    label: "Aurora",
    css: "radial-gradient(ellipse at 20% 0%, oklch(0.78 0.18 290 / .55) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, oklch(0.72 0.20 200 / .45) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, oklch(0.70 0.22 330 / .45) 0%, transparent 55%)",
  },
  {
    id: "sunset",
    label: "Sunset",
    css: "linear-gradient(135deg, oklch(0.78 0.18 40) 0%, oklch(0.66 0.22 330) 100%)",
  },
  {
    id: "forest",
    label: "Forest",
    css: "linear-gradient(135deg, oklch(0.45 0.10 155) 0%, oklch(0.35 0.08 220) 100%)",
  },
  {
    id: "ocean",
    label: "Ocean",
    css: "linear-gradient(180deg, oklch(0.55 0.15 220) 0%, oklch(0.30 0.12 250) 100%)",
  },
  {
    id: "mono",
    label: "Mono",
    css: "linear-gradient(135deg, oklch(0.20 0.01 260) 0%, oklch(0.10 0.01 260) 100%)",
  },
  {
    id: "rose",
    label: "Rose",
    css: "linear-gradient(135deg, oklch(0.85 0.10 20) 0%, oklch(0.75 0.16 350) 100%)",
  },
  {
    id: "mint",
    label: "Mint",
    css: "linear-gradient(135deg, oklch(0.85 0.10 160) 0%, oklch(0.78 0.10 200) 100%)",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversationId: string;
  userId: string;
  current?: string | null;
  onSaved: (wp: string | null) => void;
}

export function WallpaperPicker({
  open,
  onOpenChange,
  conversationId,
  userId,
  current,
  onSaved,
}: Props) {
  const [busy, setBusy] = useState(false);

  const save = async (id: string) => {
    setBusy(true);
    const wp = id === "default" ? null : id;
    const { error } = await supabase
      .from("conversation_members")
      .update({ wallpaper: wp })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSaved(wp);
    onOpenChange(false);
    toast.success("Wallpaper updated");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a chat wallpaper</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {WALLPAPERS.map((w) => {
            const active = (current ?? "default") === w.id;
            return (
              <button
                key={w.id}
                disabled={busy}
                onClick={() => save(w.id)}
                className={`group relative flex h-24 items-end overflow-hidden rounded-xl border-2 transition-all ${
                  active ? "border-primary shadow-elegant" : "border-border hover:border-primary/50"
                }`}
                style={
                  w.css
                    ? { backgroundImage: w.css, backgroundSize: "cover" }
                    : undefined
                }
              >
                {!w.css && (
                  <div className="absolute inset-0 bg-muted" />
                )}
                <div className="relative z-10 w-full bg-black/40 px-2 py-1 text-left text-xs font-medium text-white backdrop-blur-sm">
                  {w.label}
                </div>
                {active && (
                  <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function wallpaperBackground(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  const w = WALLPAPERS.find((x) => x.id === id);
  return w?.css || undefined;
}
