import { Message } from "@/hooks/useMessages";
import { UserAvatar } from "./UserAvatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { CheckCheck, Reply, Smile, Trash2, Forward, MoreVertical, Flag, Ban, Play, Pause, Download } from "lucide-react";
import { format } from "date-fns";
import { useMemo, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PollCard } from "./PollCard";
import { ReportDialog } from "./ReportDialog";

interface Props {
  message: Message;
  isMine: boolean;
  showSender: boolean;
  isGroup: boolean;
  currentUserId: string;
  onReply: (m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
  onDelete: (m: Message, forEveryone: boolean) => void;
  onForward: (m: Message) => void;
  isBlocked?: (id: string) => boolean;
  onBlock?: (id: string) => void;
}

const POLL_TAG = /__poll__:([0-9a-f-]{36})/i;
const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

export function MessageBubble({
  message,
  isMine,
  showSender,
  isGroup,
  currentUserId,
  onReply,
  onReact,
  onDelete,
  onForward,
  isBlocked = () => false,
  onBlock,
}: Props) {
  const [showReactions, setShowReactions] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const pollMatch = message.content?.match(POLL_TAG);
  const pollId = pollMatch?.[1] ?? null;
  const cleanedContent = useMemo(
    () => (message.content || "").replace(POLL_TAG, "").replace(/^📊 Poll:\s*/i, "").trim(),
    [message.content]
  );

  const blockedSender = !isMine && isBlocked(message.sender_id);
  const isDeleted = message.deleted_for_everyone;
  const isHidden = (message.deleted_for_users || []).includes(currentUserId);
  if (isHidden) return null;
  if (blockedSender)
    return (
      <div className="px-4 py-1 text-center text-[11px] italic text-muted-foreground">
        Message from blocked user hidden
      </div>
    );

  // group reactions
  const reactionMap = new Map<string, number>();
  (message.reactions || []).forEach((r) => {
    reactionMap.set(r.emoji, (reactionMap.get(r.emoji) || 0) + 1);
  });
  const myReactions = new Set(
    (message.reactions || []).filter((r) => r.user_id === currentUserId).map((r) => r.emoji)
  );

  return (
    <div
      className={`group flex w-full gap-2 px-2 sm:px-4 ${
        isMine ? "justify-end" : "justify-start"
      } animate-fade-in-up`}
    >
      {!isMine && isGroup && (
        <div className="w-8 shrink-0">
          {showSender && (
            <UserAvatar
              size={32}
              name={message.sender?.display_name}
              url={message.sender?.avatar_url}
            />
          )}
        </div>
      )}
      <div className={`flex max-w-[85%] flex-col sm:max-w-[70%] ${isMine ? "items-end" : "items-start"}`}>
        {showSender && !isMine && isGroup && (
          <span className="mb-0.5 ml-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
            {message.sender?.display_name}
            {message.sender?.badges?.some((b) => b === "verified" || b === "admin") && (
              <VerifiedBadge size={12} />
            )}
          </span>
        )}
        <div className="relative">
          <div
            className={`relative rounded-2xl px-3 py-2 shadow-bubble ${
              isMine
                ? "rounded-br-md bg-bubble-out text-bubble-out-foreground"
                : "rounded-bl-md bg-bubble-in text-bubble-in-foreground backdrop-blur-md"
            }`}
          >
            {message.reply_message && (
              <div
                className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${
                  isMine ? "border-primary/60 bg-black/5" : "border-primary bg-primary/10"
                }`}
              >
                <div className="font-semibold text-primary">Reply</div>
                <div className="line-clamp-2 opacity-80">
                  {message.reply_message.content || "Message"}
                </div>
              </div>
            )}

            {isDeleted ? (
              <p className="text-sm italic opacity-60">🚫 This message was deleted</p>
            ) : message.type === "image" && message.media_url ? (
              <a href={message.media_url} target="_blank" rel="noreferrer">
                <img
                  src={message.media_url}
                  alt="attachment"
                  className="max-h-72 rounded-lg object-cover"
                />
              </a>
            ) : message.type === "voice" && message.media_url ? (
              <VoicePlayer url={message.media_url} mine={isMine} />
            ) : message.type === "file" && message.media_url ? (
              <a
                href={message.media_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg bg-black/10 px-2 py-1.5 text-sm hover:bg-black/15"
              >
                <Download className="h-4 w-4" />
                <span className="line-clamp-1">{message.content || "File"}</span>
              </a>
            ) : pollId ? (
              <PollCard pollId={pollId} />
            ) : (
              cleanedContent && (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {cleanedContent}
                </p>
              )
            )}

            <div
              className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                isMine ? "text-bubble-out-foreground/60" : "text-muted-foreground"
              }`}
            >
              <span>{format(new Date(message.created_at), "HH:mm")}</span>
              {isMine && !isDeleted && <CheckCheck className="h-3 w-3" />}
            </div>
          </div>

          {/* Quick action toolbar */}
          {!isDeleted && (
            <div
              className={`absolute -top-3 ${
                isMine ? "left-0" : "right-0"
              } flex translate-y-1 items-center gap-0.5 rounded-full border border-border bg-popover/90 p-0.5 opacity-0 shadow-elegant backdrop-blur-md transition-all group-hover:translate-y-0 group-hover:opacity-100`}
            >
              <button
                type="button"
                onClick={() => setShowReactions((v) => !v)}
                className="rounded-full p-1.5 hover:bg-accent/20"
                aria-label="React"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onReply(message)}
                className="rounded-full p-1.5 hover:bg-accent/20"
                aria-label="Reply"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="rounded-full p-1.5 hover:bg-accent/20" aria-label="More">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isMine ? "end" : "start"} className="z-50">
                  <DropdownMenuItem onClick={() => onForward(message)}>
                    <Forward className="mr-2 h-4 w-4" /> Copy / Forward
                  </DropdownMenuItem>
                  {!isMine && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setReportOpen(true)}>
                        <Flag className="mr-2 h-4 w-4" /> Report message
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onBlock?.(message.sender_id)}>
                        <Ban className="mr-2 h-4 w-4" /> Block user
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onDelete(message, false)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete for me
                  </DropdownMenuItem>
                  {isMine && (
                    <DropdownMenuItem
                      onClick={() => onDelete(message, true)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete for everyone
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Reaction picker */}
          {showReactions && (
            <div
              className={`absolute z-20 mt-1 flex gap-1 rounded-full border border-border bg-popover/90 p-1 shadow-elegant backdrop-blur-md ${
                isMine ? "right-0" : "left-0"
              }`}
            >
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onReact(message, e);
                    setShowReactions(false);
                  }}
                  className="rounded-full p-1 text-lg transition-transform hover:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {reactionMap.size > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${isMine ? "justify-end" : "justify-start"}`}>
            {Array.from(reactionMap.entries()).map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(message, emoji)}
                className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors ${
                  myReactions.has(emoji)
                    ? "border-primary bg-primary/15"
                    : "border-border bg-card hover:bg-accent/10"
                }`}
              >
                <span>{emoji}</span>
                <span className="text-muted-foreground">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        messageId={message.id}
        reportedUserId={message.sender_id}
      />
    </div>
  );
}

function VoicePlayer({ url, mine }: { url: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play();
  };

  return (
    <div className="flex items-center gap-2 py-0.5">
      <button
        type="button"
        onClick={toggle}
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          mine ? "bg-black/15" : "bg-primary/15"
        } transition-transform hover:scale-105`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
      </button>
      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-black/15">
          <div
            className="h-full rounded-full bg-gradient-brand transition-all"
            style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[10px] opacity-70">
          {formatTime(playing ? progress : duration || progress)}
        </span>
      </div>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = (e.currentTarget as HTMLAudioElement).duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => setProgress((e.currentTarget as HTMLAudioElement).currentTime)}
      />
    </div>
  );
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
