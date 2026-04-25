import { useRef, useState, FormEvent, KeyboardEvent, useEffect } from "react";
import { Smile, Send, Mic, Paperclip, X, Reply, Image as ImageIcon, Square, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message } from "@/hooks/useMessages";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { CreatePollDialog } from "./CreatePollDialog";

interface Props {
  conversationId: string;
  onSend: (text: string) => Promise<void> | void;
  onTyping: () => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  disabled?: boolean;
  isGroup?: boolean;
}

export function MessageComposer({
  conversationId,
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  disabled,
  isGroup,
}: Props) {
  const { user } = useAuth();
  const [value, setValue] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const { theme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

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

  const onPickFile = () => fileRef.current?.click();

  const handleFile = async (file: File) => {
    if (!user || !conversationId) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File too large (max 15MB)");
      return;
    }
    setUploading(true);
    try {
      const isImage = file.type.startsWith("image/");
      const ext = file.name.split(".").pop() || (isImage ? "jpg" : "bin");
      const path = `${conversationId}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("chat-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl;
      if (!url) throw new Error("Could not get URL");

      const { error: insErr } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        type: isImage ? "image" : "file",
        content: isImage ? null : file.name,
        media_url: url,
      });
      if (insErr) throw insErr;
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const startRecording = async () => {
    if (!user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadVoice(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSecs((s) => {
          if (s >= 120) {
            stopRecording();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = (cancel = false) => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (cancel) {
      mr.onstop = () => mr.stream.getTracks().forEach((t) => t.stop());
      chunksRef.current = [];
    }
    mr.stop();
    mediaRecorderRef.current = null;
  };

  const uploadVoice = async (blob: Blob) => {
    if (!user || !conversationId) return;
    setUploading(true);
    try {
      const path = `${conversationId}/${user.id}/${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage
        .from("voice-notes")
        .upload(path, blob, { contentType: "audio/webm", upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("voice-notes")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl;
      if (!url) throw new Error("Could not get URL");

      const { error: insErr } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        type: "voice",
        media_url: url,
      });
      if (insErr) throw insErr;
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    } catch (e: any) {
      toast.error(e.message || "Voice upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-thin border-t border-border/40">
      {replyTo && (
        <div className="flex items-start gap-2 border-b border-border/50 bg-muted/30 px-3 py-2 text-sm">
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
        <div className="border-b border-border/50">
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

      {recording ? (
        <div className="flex items-center gap-3 p-3">
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-destructive/10 px-4 py-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm font-medium text-destructive">Recording</span>
            <span className="ml-auto text-sm tabular-nums text-muted-foreground">
              {Math.floor(recordSecs / 60)}:{(recordSecs % 60).toString().padStart(2, "0")}
            </span>
          </div>
          <Button
            type="button"
            size="icon"
            onClick={() => stopRecording(false)}
            className="h-10 w-10 shrink-0 rounded-full bg-gradient-brand text-primary-foreground shadow-elegant"
            aria-label="Send voice"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex items-end gap-1.5 p-2 sm:p-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
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
            onClick={onPickFile}
            disabled={uploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Attach"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          {isGroup && (
            <CreatePollDialog
              conversationId={conversationId}
              trigger={
                <button
                  type="button"
                  className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
                  aria-label="Create poll"
                >
                  <BarChart3 className="h-5 w-5" />
                </button>
              }
            />
          )}

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
            placeholder={uploading ? "Uploading…" : "Type a message"}
            disabled={disabled || uploading}
            className="min-h-[40px] max-h-[140px] flex-1 resize-none rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-sm leading-relaxed outline-none ring-ring backdrop-blur placeholder:text-muted-foreground focus-visible:ring-2"
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
              onClick={startRecording}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground shadow-elegant transition-transform active:scale-95"
              aria-label="Record voice note"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
