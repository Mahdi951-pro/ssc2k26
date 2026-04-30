import { useEffect, useRef, useState } from "react";
import { Conversation } from "@/hooks/useConversations";
import { useMessages, Message } from "@/hooks/useMessages";
import { useTyping } from "@/hooks/useTyping";
import { useAuth } from "@/components/auth/AuthProvider";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { UserAvatar } from "./UserAvatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { ArrowLeft, Megaphone, Users, Loader2, MessageCircle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isSameDay } from "date-fns";
import { useBlocks } from "@/hooks/useBlocks";

interface Props {
  conversation: Conversation | null;
  onBack: () => void;
}

const TOXIC = ["fuck", "shit", "bastard", "asshole", "bitch", "dick", "cunt"];
function moderate(text: string) {
  let cleaned = text;
  let flagged = false;
  TOXIC.forEach((w) => {
    const re = new RegExp(`\\b${w}\\w*\\b`, "ig");
    if (re.test(cleaned)) {
      flagged = true;
      cleaned = cleaned.replace(re, (m) => "*".repeat(m.length));
    }
  });
  return { cleaned, flagged };
}

export function ChatPane({ conversation, onBack }: Props) {
  const { user } = useAuth();
  const { messages, loading } = useMessages(conversation?.id, user?.id);
  const { typingUsers, sendTyping } = useTyping(conversation?.id, user?.id);
  const { isBlocked, block } = useBlocks();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAnnouncement = conversation?.type === "announcement";
  const isGroup = conversation?.type !== "direct";
  const canPost = !isAnnouncement || isAdmin;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, typingUsers.length]);

  const send = async (text: string) => {
    if (!conversation || !user) return;
    const { cleaned, flagged } = moderate(text);
    if (flagged) toast.message("Auto-moderated", { description: "Some words were filtered." });
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content: cleaned,
      type: "text",
      reply_to: replyTo?.id ?? null,
    });
    if (error) toast.error(error.message);
    else setReplyTo(null);
  };

  const react = async (msg: Message, emoji: string) => {
    if (!user) return;
    const mine = (msg.reactions || []).find((r) => r.user_id === user.id && r.emoji === emoji);
    if (mine) {
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", msg.id)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions").insert({
        message_id: msg.id,
        user_id: user.id,
        emoji,
      });
    }
  };

  const del = async (msg: Message, forEveryone: boolean) => {
    if (!user) return;
    if (forEveryone) {
      const { error } = await supabase
        .from("messages")
        .update({ deleted_for_everyone: true, content: null, media_url: null })
        .eq("id", msg.id);
      if (error) toast.error(error.message);
    } else {
      const newArr = Array.from(new Set([...(msg.deleted_for_users || []), user.id]));
      const { error } = await supabase
        .from("messages")
        .update({ deleted_for_users: newArr })
        .eq("id", msg.id);
      if (error) toast.error(error.message);
    }
  };

  const forward = async (msg: Message) => {
    // simplified: copy to clipboard for now
    if (msg.content) {
      navigator.clipboard.writeText(msg.content);
      toast.success("Message copied — paste anywhere to forward");
    }
  };

  if (!conversation) {
    return (
      <div className="hidden h-full flex-1 flex-col items-center justify-center bg-muted/30 p-8 md:flex">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-brand shadow-elegant">
          <MessageCircle className="h-10 w-10 text-primary-foreground" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">SSC 2k26 Chat</h2>
        <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
          Select a conversation to start messaging, or start a new chat with a batchmate.
        </p>
      </div>
    );
  }

  const name = conversation.type === "direct"
    ? conversation.other_member?.display_name || "Direct chat"
    : conversation.name || "Group";
  const subtitle = conversation.type === "direct"
    ? conversation.other_member?.is_online
      ? "online"
      : "offline"
    : conversation.description || (isAnnouncement ? "Announcement channel" : "Group chat");

  // Build day-grouped messages
  let lastDate: Date | null = null;
  let lastSender: string | null = null;

  return (
    <section className="aurora flex h-full flex-1 flex-col">
      {/* Header */}
      <header className="glass-thin relative z-10 flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent/10 md:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {conversation.type === "direct" ? (
          <UserAvatar
            name={name}
            url={conversation.other_member?.avatar_url}
            online={conversation.other_member?.is_online}
            showStatus
            size={40}
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground">
            {isAnnouncement ? <Megaphone className="h-5 w-5" /> : <Users className="h-5 w-5" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate font-semibold">
            <span className="truncate">{name}</span>
            {conversation.type === "direct" &&
              conversation.other_member?.badges?.some(
                (b) => b === "verified" || b === "admin"
              ) && <VerifiedBadge size={14} />}
            {(conversation as any).is_section_locked && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {typingUsers.length > 0
              ? `${typingUsers.map((t) => t.name).join(", ")} typing…`
              : subtitle}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto py-4"
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand shadow-elegant">
              <MessageCircle className="h-8 w-8 text-primary-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No messages yet — say hi 👋
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((m) => {
              const date = new Date(m.created_at);
              const showDate = !lastDate || !isSameDay(date, lastDate);
              const showSender = lastSender !== m.sender_id || showDate;
              lastDate = date;
              lastSender = m.sender_id;
              return (
                <div key={m.id}>
                  {showDate && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-soft">
                        {format(date, "EEEE, MMM d")}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={m}
                    isMine={m.sender_id === user!.id}
                    showSender={showSender}
                    isGroup={isGroup}
                    currentUserId={user!.id}
                    onReply={setReplyTo}
                    onReact={react}
                    onDelete={del}
                    onForward={forward}
                    isBlocked={isBlocked}
                    onBlock={block}
                  />
                </div>
              );
            })}
            {typingUsers.length > 0 && (
              <div className="px-4 py-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                  </span>
                  {typingUsers.map((t) => t.name).join(", ")} is typing
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {canPost ? (
        <MessageComposer
          conversationId={conversation.id}
          isGroup={isGroup}
          onSend={send}
          onTyping={sendTyping}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      ) : (
        <div className="glass-thin flex items-center justify-center gap-2 px-4 py-3 text-xs text-muted-foreground">
          <Megaphone className="h-3.5 w-3.5" />
          Only admins can post in this announcement channel.
        </div>
      )}
    </section>
  );
}
