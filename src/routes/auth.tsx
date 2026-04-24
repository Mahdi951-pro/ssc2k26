import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/chat" });
  }, [user, loading, navigate]);

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
    else toast.success("Welcome to SSC 2k26! 🎉");
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        className="absolute inset-0 -z-10 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at top left, var(--primary-glow), transparent 60%), radial-gradient(ellipse at bottom right, var(--accent), transparent 60%)",
        }}
      />
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-elegant">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">SSC 2k26 Chat</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-elegant backdrop-blur-xl">
          {forgot ? (
            <>
              <h1 className="text-2xl font-bold">Reset password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll email you a reset link.
              </p>
              <form onSubmit={handleForgot} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input id="forgot-email" name="email" type="email" required autoComplete="email" />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-brand text-primary-foreground">
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5 space-y-4">
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

              <TabsContent value="signup" className="mt-5 space-y-4">
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

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to chat respectfully with your batchmates.
        </p>
      </div>
    </div>
  );
}
