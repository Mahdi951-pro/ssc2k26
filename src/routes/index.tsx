import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Users, Shield, Sparkles, Bell, Zap, BarChart3 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { gsap } from "gsap";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "SSC 2k26 Chat — Your batch, in one chat" },
      {
        name: "description",
        content:
          "Real-time class group chats, polls, announcements and reminders for SSC 2026 students.",
      },
    ],
  }),
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/chat" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!heroRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-hero]", {
        opacity: 0,
        y: 28,
        duration: 0.9,
        stagger: 0.08,
        ease: "power3.out",
      });
      gsap.from("[data-feature]", {
        opacity: 0,
        y: 24,
        duration: 0.7,
        stagger: 0.06,
        delay: 0.4,
        ease: "power3.out",
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={heroRef} className="aurora min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-thin">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo size={36} rounded="rounded-xl" />
            <span className="text-lg font-bold tracking-tight">SSC 2k26 Chat</span>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="rounded-full bg-gradient-brand text-primary-foreground shadow-elegant">
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:py-32">
          <div data-hero className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Built for the SSC 2026 batch
          </div>
          <h1 data-hero className="mt-6 text-4xl font-bold tracking-tight sm:text-7xl">
            Your batch,{" "}
            <span className="text-gradient-brand">all in one chat.</span>
          </h1>
          <p data-hero className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Realtime DMs, class groups, polls, announcements and study reminders — wrapped in a soft, liquid-glass interface.
          </p>
          <div data-hero className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth">
              <Button size="lg" className="w-full rounded-full bg-gradient-brand text-primary-foreground shadow-elegant transition-transform hover:scale-105 sm:w-auto">
                Join the batch chat
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="w-full rounded-full glass sm:w-auto">
                I already have an account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-28">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Users, title: "Section groups", desc: "Section A, B, Study Hub & more — auto-joined on signup." },
            { icon: Bell, title: "Announcements", desc: "Never miss an official batch notice." },
            { icon: BarChart3, title: "Polls in chat", desc: "Vote on study plans, events, anything." },
            { icon: Zap, title: "Lightning realtime", desc: "Instant messages, typing & read receipts." },
            { icon: Shield, title: "Privacy first", desc: "RLS-secured. Block, report, mute anytime." },
            { icon: Sparkles, title: "Liquid glass UI", desc: "Apple-style aesthetics with springy GSAP motion." },
          ].map((f) => (
            <div
              key={f.title}
              data-feature
              className="glass rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-elegant"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        SSC 2k26 Chat · Built for the batch, by the batch.
      </footer>
    </div>
  );
}
