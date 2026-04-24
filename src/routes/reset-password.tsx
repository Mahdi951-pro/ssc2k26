import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => ({ meta: [{ title: "Reset password — SSC 2k26 Chat" }] }),
});

function ResetPassword() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase will set a session via URL hash on recovery link
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password") || "");
    if (pw.length < 8) {
      toast.error("Min 8 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      navigate({ to: "/chat" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elegant">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold">Reset password</span>
        </div>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Verifying recovery link…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" name="password" type="password" required minLength={8} />
            </div>
            <Button disabled={busy} type="submit" className="w-full bg-gradient-brand text-primary-foreground">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
