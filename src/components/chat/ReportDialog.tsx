import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { Loader2, Flag } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  messageId?: string;
  reportedUserId?: string;
}

const REASONS = [
  "Spam or scam",
  "Harassment or bullying",
  "Hate speech",
  "Inappropriate content",
  "Other",
];

export function ReportDialog({ open, onOpenChange, messageId, reportedUserId }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const final = details.trim() ? `${reason}: ${details.trim().slice(0, 500)}` : reason;
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      message_id: messageId ?? null,
      reported_user_id: reportedUserId ?? null,
      reason: final,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Report submitted. Thank you 🙏");
      setDetails("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            Report content
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
            {REASONS.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-card/60 p-2.5 transition-colors hover:bg-accent/10"
              >
                <RadioGroupItem value={r} />
                <span className="text-sm">{r}</span>
              </label>
            ))}
          </RadioGroup>
          <div className="space-y-1.5">
            <Label htmlFor="details">More details (optional)</Label>
            <Textarea
              id="details"
              maxLength={500}
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything moderators should know..."
            />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-gradient-brand text-primary-foreground">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
