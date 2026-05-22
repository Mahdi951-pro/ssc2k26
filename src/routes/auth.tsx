import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";
import { gsap } from "gsap";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — SSC 2k26 Chat" },
      { name: "description", content: "Sign in or create your SSC 2k26 Chat account." },
    ],
  }),
});

const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Name too short").max(50, "Max 50 chars"),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Min 8 characters").max(72),
});

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Password required").max(72),
});

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1 0-3.4 2.7-6.1 6-6.1 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.07-1.1-.16-1.6H12z" />
    </svg>
  );
}

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/chat" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!cardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-anim]", {
        opacity: 0,
        y: 20,
        scale: 0.97,
        duration: 0.7,
        stagger: 0.05,
        ease: "power3.out",
      });
    }, cardRef);
    return () => ctx.revert();
  }, [forgot]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      displayName: fd.get("displayName"),
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/chat`,
        data: { display_name: parsed.data.displayName },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome to SSC 2k26! 🎉 Check your email to confirm.");
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back!");
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/chat`,
    });
    if (result.error) {
      setBusy(false);
      toast.error(result.error.message || "Google sign-in failed");
      return;
    }
    if (!result.redirected) {
      // already signed in (tokens returned)
      navigate({ to: "/chat" });
    }
  };

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    if (!email) {
      toast.error("Enter your email");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Check your email for a reset link");
  };

  return (
    <div className="aurora relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div ref={cardRef} className="relative z-10 w-full max-w-md">
        <Link to="/" data-anim className="mb-6 flex items-center justify-center gap-2">
          <BrandLogo size={44} rounded="rounded-2xl" />
          <span className="text-xl font-bold tracking-tight">SSC 2k26 Chat</span>
        </Link>

        <div data-anim className="glass-strong rounded-3xl p-7">
          {forgot ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll email you a reset link.
              </p>
              <form onSubmit={handleForgot} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input id="forgot-email" name="email" type="email" required autoComplete="email" />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-brand text-primary-foreground shadow-elegant">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
                <button
                  type="button"
                  onClick={() => setForgot(false)}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Back to sign in
                </button>
              </form>
            </>
          ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/50 p-1">
                <TabsTrigger value="signin" className="rounded-full">Sign in</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-full">Create account</TabsTrigger>
              </TabsList>

              {/* Google button */}
              <Button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                variant="outline"
                className="mt-5 w-full gap-2 rounded-2xl border-border/60 bg-background/60 backdrop-blur transition-transform hover:scale-[1.01]"
                size="lg"
              >
                <GoogleIcon className="h-5 w-5" />
                Continue with Google
              </Button>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="si-pw">Password</Label>
                      <button
                        type="button"
                        onClick={() => setForgot(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot?
                      </button>
                    </div>
                    <Input id="si-pw" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  <Button type="submit" disabled={busy} className="w-full bg-gradient-brand text-primary-foreground shadow-elegant">
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Your name</Label>
                    <Input id="su-name" name="displayName" required maxLength={50} placeholder="e.g. Aisha Khan" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pw">Password</Label>
                    <Input id="su-pw" name="password" type="password" required minLength={8} autoComplete="new-password" />
                    <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                  </div>
                  <Button type="submit" disabled={busy} className="w-full bg-gradient-brand text-primary-foreground shadow-elegant">
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <p data-anim className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to chat respectfully with your batchmates.
        </p>
      </div>
    </div>
  );
}
