import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, BarChart3 } from "lucide-react";

interface Props {
  conversationId: string;
  trigger?: React.ReactNode;
}

export function CreatePollDialog({ conversationId, trigger }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multiChoice, setMultiChoice] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (q.length < 1) return toast.error("Question is required");
    if (opts.length < 2) return toast.error("Add at least 2 options");
    if (opts.length > 8) return toast.error("Max 8 options");

    setBusy(true);
    const { data: poll, error } = await supabase
      .from("polls")
      .insert({
        conversation_id: conversationId,
        created_by: user.id,
        question: q,
        options: opts,
        multi_choice: multiChoice,
      })
      .select()
      .single();

    if (error || !poll) {
      setBusy(false);
      toast.error(error?.message || "Failed");
      return;
    }

    // Post a system message linking to the poll so it appears in the chat thread
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      type: "text",
      content: `📊 Poll: ${q}\n__poll__:${poll.id}`,
    });
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    setBusy(false);
    setOpen(false);
    setQuestion("");
    setOptions(["", ""]);
    setMultiChoice(false);
    toast.success("Poll posted");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground" aria-label="Create poll">
            <BarChart3 className="h-5 w-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-strong max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Create a poll
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q">Question</Label>
            <Input id="q" maxLength={200} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What's the plan for Friday?" />
          </div>
          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={o}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value;
                    setOptions(next);
                  }}
                  maxLength={80}
                  placeholder={`Option ${i + 1}`}
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    aria-label="Remove option"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 8 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, ""])} className="w-full">
                <Plus className="mr-1 h-3.5 w-3.5" /> Add option
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/40 p-3">
            <div>
              <div className="text-sm font-medium">Allow multiple choices</div>
              <div className="text-xs text-muted-foreground">Voters can pick more than one</div>
            </div>
            <Switch checked={multiChoice} onCheckedChange={setMultiChoice} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-gradient-brand text-primary-foreground">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Post poll
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
