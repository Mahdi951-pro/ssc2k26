import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  initial: string;
}

export function EditMessageDialog({ open, onOpenChange, messageId, initial }: Props) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => setValue(initial), [initial, open]);

  const save = async () => {
    const text = value.trim();
    if (!text) return;
    setBusy(true);
    const { error } = await supabase
      .from("messages")
      .update({ content: text, edited_at: new Date().toISOString() })
      .eq("id", messageId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit message</DialogTitle>
        </DialogHeader>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          autoFocus
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !value.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
