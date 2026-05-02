import { useEffect, useState } from "react";
import { Pin, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  conversationId: string;
  pinnedMessageId: string | null | undefined;
  isAdmin: boolean;
  isCreator: boolean;
  onJump: (messageId: string) => void;
}

export function PinnedBanner({
  conversationId,
  pinnedMessageId,
  isAdmin,
  isCreator,
  onJump,
}: Props) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!pinnedMessageId) {
      setPreview(null);
      return;
    }
    supabase
      .from("messages")
      .select("content, type")
      .eq("id", pinnedMessageId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setPreview(null);
        setPreview(
          data.type === "image"
            ? "📷 Photo"
            : data.type === "voice"
              ? "🎙️ Voice note"
              : data.type === "file"
                ? "📎 File"
                : (data.content || "").slice(0, 80),
        );
      });
  }, [pinnedMessageId]);

  if (!pinnedMessageId || !preview) return null;

  const canUnpin = isAdmin || isCreator;

  const unpin = async () => {
    await supabase
      .from("conversations")
      .update({ pinned_message_id: null })
      .eq("id", conversationId);
  };

  return (
    <button
      type="button"
      onClick={() => onJump(pinnedMessageId)}
      className="glass-thin relative z-10 flex w-full shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2 text-left transition-colors hover:bg-accent/10"
    >
      <Pin className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
          Pinned message
        </div>
        <div className="truncate text-xs text-foreground/80">{preview}</div>
      </div>
      {canUnpin && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            unpin();
          }}
          className="rounded-full p-1 hover:bg-muted"
          aria-label="Unpin"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}
