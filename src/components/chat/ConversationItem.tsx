import { Conversation } from "@/hooks/useConversations";
import { UserAvatar } from "./UserAvatar";
import { Pin, Megaphone, Users, BellOff } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

interface Props {
  conversation: Conversation;
  active: boolean;
  currentUserId: string;
  onClick: () => void;
}

export function ConversationItem({ conversation, active, currentUserId, onClick }: Props) {
  const isDirect = conversation.type === "direct";
  const isAnnouncement = conversation.type === "announcement";
  const name = isDirect
    ? conversation.other_member?.display_name || "Direct chat"
    : conversation.name || "Group";

  const lastMsg = conversation.last_message;
  const preview = lastMsg
    ? lastMsg.type === "image"
      ? "📷 Photo"
      : lastMsg.type === "voice"
        ? "🎤 Voice note"
        : lastMsg.type === "file"
          ? "📎 File"
          : lastMsg.content || ""
    : isAnnouncement
      ? "Official batch notices"
      : "Start the conversation";

  const time = lastMsg?.created_at
    ? formatDistanceToNowStrict(new Date(lastMsg.created_at), { addSuffix: false })
    : "";

  const isMine = lastMsg?.sender_id === currentUserId;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
        active
          ? "bg-sidebar-accent"
          : "hover:bg-sidebar-accent/60"
      }`}
    >
      <div className="relative">
        {isDirect ? (
          <UserAvatar
            name={name}
            url={conversation.other_member?.avatar_url}
            online={conversation.other_member?.is_online}
            showStatus
            size={46}
          />
        ) : (
          <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-gradient-brand text-primary-foreground">
            {isAnnouncement ? <Megaphone className="h-5 w-5" /> : <Users className="h-5 w-5" />}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold text-sidebar-foreground">{name}</span>
            {conversation.is_pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
            {conversation.is_muted && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" />}
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{time}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">
            {isMine && lastMsg && <span className="text-muted-foreground/70">You: </span>}
            {preview}
          </p>
          {(conversation.unread_count ?? 0) > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-brand px-1.5 text-[11px] font-semibold text-primary-foreground">
              {conversation.unread_count! > 99 ? "99+" : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
