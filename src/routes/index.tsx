import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users, Shield, Sparkles, Bell, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "SSC 2k26 Chat — Your batch, in one chat" },
      {
        name: "description",
        content:
          "Real-time class group chats, announcements, polls and study reminders for SSC 2026 students.",
      },
    ],
  }),
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/chat" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-elegant">
              <MessageCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">SSC 2k26 Chat</span>
          </Link>
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at top, var(--primary-glow), transparent 60%), radial-gradient(ellipse at bottom right, var(--accent), transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:py-28">
          <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Built for the SSC 2026 batch
          </div>
          <h1 className="animate-fade-in-up mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Your batch,{" "}
            <span className="text-gradient-brand">all in one chat.</span>
          </h1>
          <p className="animate-fade-in-up mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Real-time messaging, class groups, announcements and study reminders — secured for
            students only.
          </p>
          <div className="animate-fade-in-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-brand text-primary-foreground shadow-elegant transition-transform hover:scale-105 w-full sm:w-auto">
                Join the batch chat
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                I already have an account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Users, title: "Section groups", desc: "Section A, B, Study Hub & more — auto-joined on signup." },
            { icon: Bell, title: "Announcements", desc: "Never miss an official batch notice." },
            { icon: Zap, title: "Lightning realtime", desc: "Instant messages, typing & read receipts." },
            { icon: Shield, title: "Privacy first", desc: "Row-level secured. Block, report, mute anytime." },
            { icon: Sparkles, title: "Reactions & replies", desc: "WhatsApp-style replies with Insta-style polish." },
            { icon: MessageCircle, title: "1-to-1 DMs", desc: "Private chats with anyone in the batch." },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
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

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        SSC 2k26 Chat · Built for the batch, by the batch.
      </footer>
    </div>
  );
}
