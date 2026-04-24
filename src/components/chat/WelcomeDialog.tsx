import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { Sparkles, MessageCircle, Users, Shield } from "lucide-react";
import { gsap } from "gsap";

const STORAGE_KEY_PREFIX = "ssc2k26-welcomed-";

export function WelcomeDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const key = STORAGE_KEY_PREFIX + user.id;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(key)) {
      setOpen(true);
      localStorage.setItem(key, "1");
    }
  }, [user]);

  useEffect(() => {
    if (!open || !cardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-welcome-item]", {
        opacity: 0,
        y: 20,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
      });
      gsap.fromTo(
        "[data-welcome-icon]",
        { scale: 0.6, rotate: -20 },
        { scale: 1, rotate: 0, duration: 0.9, ease: "elastic.out(1, 0.55)" }
      );
    }, cardRef);
    return () => ctx.revert();
  }, [open]);

  if (!user) return null;
  const name =
    (user.user_metadata as any)?.display_name ||
    user.email?.split("@")[0] ||
    "friend";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md overflow-hidden border-none bg-transparent p-0 shadow-none">
        <div ref={cardRef} className="aurora rounded-3xl">
          <div className="glass-strong relative z-10 rounded-3xl p-7 text-center">
            <div
              data-welcome-icon
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand shadow-elegant"
            >
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 data-welcome-item className="text-2xl font-bold tracking-tight">
              Welcome to the batch, {name}! 🎉
            </h2>
            <p data-welcome-item className="mt-2 text-sm text-muted-foreground">
              You're now part of <span className="font-semibold text-foreground">SSC 2k26 Chat</span> —
              built so the whole batch can stay in sync, every single day.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-2 text-left sm:grid-cols-3">
              {[
                { icon: Users, label: "Auto-joined section groups" },
                { icon: MessageCircle, label: "Realtime DMs & polls" },
                { icon: Shield, label: "Privacy-first & secure" },
              ].map((it) => (
                <div
                  key={it.label}
                  data-welcome-item
                  className="rounded-2xl border border-border/40 bg-card/60 p-3 text-xs"
                >
                  <it.icon className="mb-1 h-4 w-4 text-primary" />
                  <span className="font-medium leading-tight">{it.label}</span>
                </div>
              ))}
            </div>

            <Button
              data-welcome-item
              onClick={() => setOpen(false)}
              className="mt-6 w-full bg-gradient-brand text-primary-foreground shadow-elegant transition-transform hover:scale-[1.02]"
              size="lg"
            >
              Let's chat ✨
            </Button>
            <p data-welcome-item className="mt-3 text-[11px] text-muted-foreground">
              Tip: tap your avatar (top-left) to set your class &amp; section.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
