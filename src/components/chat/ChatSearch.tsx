import { useMemo, useState } from "react";
import { Search, X, ArrowDown, ArrowUp } from "lucide-react";
import { Message } from "@/hooks/useMessages";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  onJump: (id: string) => void;
}

export function ChatSearch({ open, onClose, messages, onJump }: Props) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [] as Message[];
    return messages.filter((m) => (m.content || "").toLowerCase().includes(t));
  }, [q, messages]);

  if (!open) return null;

  const go = (next: number) => {
    if (matches.length === 0) return;
    const i = (next + matches.length) % matches.length;
    setIdx(i);
    onJump(matches[i].id);
  };

  return (
    <div className="glass-thin flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2">
      <Search className="h-4 w-4 text-muted-foreground" />
      <Input
        autoFocus
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setIdx(0);
        }}
        placeholder="Search in this chat"
        className="h-9 border-transparent bg-background/60"
        onKeyDown={(e) => {
          if (e.key === "Enter") go(idx + 1);
          if (e.key === "Escape") onClose();
        }}
      />
      <span className="shrink-0 text-xs text-muted-foreground">
        {matches.length ? `${idx + 1}/${matches.length}` : "0"}
      </span>
      <button
        type="button"
        onClick={() => go(idx - 1)}
        className="rounded-full p-1.5 hover:bg-accent/15"
        aria-label="Previous"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => go(idx + 1)}
        className="rounded-full p-1.5 hover:bg-accent/15"
        aria-label="Next"
      >
        <ArrowDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full p-1.5 hover:bg-accent/15"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
