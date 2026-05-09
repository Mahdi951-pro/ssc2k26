import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUGGESTIONS = [
  "How do I pin a chat?",
  "Translate: শুভ সকাল বন্ধু",
  "Draft a polite reply for a missed call",
  "Explain message ticks",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

export function ActionLiveProDialog({ open, onOpenChange }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        toast.error("ActionLivePro is busy. Try again in a moment.");
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("AI credits exhausted. Please top up.");
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      let started = false;
      let done = false;

      const upsert = (chunk: string) => {
        acc += chunk;
        setMessages((prev) => {
          if (!started) {
            started = true;
            return [...prev, { role: "assistant", content: acc }];
          }
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: acc } : m,
          );
        });
      };

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error(e);
        toast.error("Couldn't reach ActionLivePro. Check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90svh] max-h-[90svh] w-[calc(100vw-1rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:h-[640px]">
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand shadow-soft">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-semibold leading-tight">
                ActionLivePro
              </DialogTitle>
              <p className="truncate text-[10px] text-muted-foreground">
                Your in-app AI · English & বাংলা
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={reset}
              aria-label="Clear chat"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-elegant">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-base font-semibold">Hi, I'm ActionLivePro</h3>
              <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
                Ask me anything about this app, translate, draft messages, or just chat.
                আমি বাংলাও বুঝি 🌸
              </p>
              <div className="mt-5 flex w-full flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-left text-xs transition-colors hover:bg-accent/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-soft ${
                      m.role === "user"
                        ? "rounded-br-md bg-gradient-brand text-primary-foreground"
                        : "rounded-bl-md bg-card border border-border/60"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none break-words dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2">
                        <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border/60 bg-card px-4 py-3 shadow-soft">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/60 bg-background/80 p-2.5 backdrop-blur pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask ActionLivePro…"
              rows={1}
              className="max-h-32 min-h-[42px] resize-none rounded-2xl border-border/60 bg-card text-base sm:text-sm"
            />
            <Button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-[42px] w-[42px] shrink-0 rounded-full bg-gradient-brand shadow-soft hover:opacity-90"
              aria-label="Send"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            ActionLivePro can make mistakes. Verify important info.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
