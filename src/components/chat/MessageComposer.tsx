import { useRef, useState, FormEvent, KeyboardEvent } from "react";
import { Smile, Send, Mic, Paperclip, X, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message } from "@/hooks/useMessages";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { useTheme } from "@/components/theme/ThemeProvider";

interface Props {
  onSend: (text: string) => Promise<void> | void;
  onTyping: () => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  disabled?: boolean;
}

export function MessageComposer({ onSend, onTyping, replyTo, onCancelReply, disabled }: Props) {
  const [value, setValue] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { theme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = value.trim();
    if (!text) return;
    setValue("");
    setShowEmoji(false);
    if (taRef.current) taRef.current.style.height = "auto";
    await onSend(text);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-md">
      {replyTo && (
        <div className="flex items-start gap-2 border-b border-border bg-muted/40 px-3 py-2 text-sm">
          <Reply className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-primary">Replying</div>
            <div className="line-clamp-1 text-muted-foreground">{replyTo.content}</div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="Cancel reply"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showEmoji && (
        <div className="border-b border-border">
          <EmojiPicker
            theme={isDark ? Theme.DARK : Theme.LIGHT}
            emojiStyle={EmojiStyle.NATIVE}
            width="100%"
            height={320}
            onEmojiClick={(e) => setValue((v) => v + e.emoji)}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      <form onSubmit={submit} className="flex items-end gap-2 p-2 sm:p-3">
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
          aria-label="Attach"
          title="Attachments coming soon"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onTyping();
            const ta = e.currentTarget;
            ta.style.height = "auto";
            ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
          }}
          onKeyDown={onKey}
          rows={1}
          placeholder="Type a message"
          disabled={disabled}
          className="min-h-[40px] max-h-[140px] flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm leading-relaxed outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2"
        />

        {value.trim() ? (
          <Button
            type="submit"
            size="icon"
            disabled={disabled}
            className="h-10 w-10 shrink-0 rounded-full bg-gradient-brand text-primary-foreground shadow-elegant"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground shadow-elegant"
            aria-label="Voice note (coming soon)"
            title="Voice notes coming soon"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </form>
    </div>
  );
}
