import { useEffect, useRef, useState } from "react";
import { Conversation } from "@/hooks/useConversations";
import { useMessages, Message } from "@/hooks/useMessages";
import { useTyping } from "@/hooks/useTyping";
import { useAuth } from "@/components/auth/AuthProvider";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { UserAvatar } from "./UserAvatar";
import { VerifiedBadge } from "./VerifiedBadge";
import {
  ArrowLeft,
  Megaphone,
  Users,
  Loader2,
  MessageCircle,
  Lock,
  ImageIcon,
  MoreVertical,
  Search as SearchIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict, isSameDay } from "date-fns";
import { useBlocks } from "@/hooks/useBlocks";
import { WallpaperPicker, wallpaperBackground } from "./WallpaperPicker";
import { PinnedBanner } from "./PinnedBanner";
import { ChatSearch } from "./ChatSearch";
import { ImageLightbox } from "./ImageLightbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { gsap } from "gsap";

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
  const userId = user?.id;
  const { messages, loading } = useMessages(conversation?.id, user?.id);
  const { typingUsers, sendTyping } = useTyping(conversation?.id, user?.id);
  const { isBlocked, block } = useBlocks();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [wallpaper, setWallpaper] = useState<string | null>(conversation?.wallpaper ?? null);
  const [wpOpen, setWpOpen] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(conversation?.pinned_message_id ?? null);
  const [otherMembersCount, setOtherMembersCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const isAnnouncement = conversation?.type === "announcement";
  const isGroup = conversation?.type !== "direct";
  const canPost = !isAnnouncement || isAdmin;
  const isSectionLocked = Boolean(
    (conversation as (Conversation & { is_section_locked?: boolean }) | null)?.is_section_locked,
  );

  // Reset local state when conversation switches
  useEffect(() => {
    setWallpaper(conversation?.wallpaper ?? null);
    setPinnedId(conversation?.pinned_message_id ?? null);
    setReplyTo(null);
  }, [conversation?.id, conversation?.wallpaper, conversation?.pinned_message_id]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [userId]);

  // Other members count for ticks
  useEffect(() => {
    if (!conversation?.id || !userId) {
      setOtherMembersCount(0);
      return;
    }
    supabase
      .from("conversation_members")
      .select("user_id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .neq("user_id", userId)
      .then(({ count }) => setOtherMembersCount(count ?? 0));
  }, [conversation?.id, userId]);

  // Subscribe to conversation row changes (pinned message updates)
  useEffect(() => {
    if (!conversation?.id) return;
    const ch = supabase
      .channel(`conv-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversation.id}`,
        },
        (payload) => {
          const p = payload.new as { pinned_message_id: string | null };
          setPinnedId(p.pinned_message_id);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversation?.id]);

  // GSAP header entry
  useEffect(() => {
    if (!headerRef.current || !conversation) return;
    gsap.fromTo(
      headerRef.current,
      { y: -12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" },
    );
  }, [conversation?.id]);

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
    if (msg.content) {
      navigator.clipboard.writeText(msg.content);
      toast.success("Message copied — paste anywhere to forward");
    }
  };

  const jumpToMessage = (id: string) => {
    const node = document.querySelector(`[data-message-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (node && scrollRef.current) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      gsap.fromTo(
        node,
        { backgroundColor: "rgba(168,85,247,0.18)" },
        { backgroundColor: "transparent", duration: 1.6, ease: "power2.out" },
      );
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

  const name =
    conversation.type === "direct"
      ? conversation.other_member?.display_name || "Direct chat"
      : conversation.name || "Group";
  const otherMember = conversation.other_member;
  let subtitle: string;
  if (conversation.type === "direct") {
    if (otherMember?.is_online) {
      subtitle = "online";
    } else if (otherMember?.privacy_show_online !== false && otherMember?.last_seen) {
      try {
        subtitle = `last seen ${formatDistanceToNowStrict(new Date(otherMember.last_seen), { addSuffix: true })}`;
      } catch {
        subtitle = "offline";
      }
    } else {
      subtitle = "offline";
    }
  } else {
    subtitle = conversation.description || (isAnnouncement ? "Announcement channel" : "Group chat");
  }

  // Build day-grouped messages
  let lastDate: Date | null = null;
  let lastSender: string | null = null;

  const wpBg = wallpaperBackground(wallpaper);
  const imageUrls = messages
    .filter((m) => m.type === "image" && m.media_url && !m.deleted_for_everyone)
    .map((m) => m.media_url as string);

  const openImage = (url: string) => {
    const idx = imageUrls.indexOf(url);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  return (
    <section
      className="aurora flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      style={
        wpBg
          ? {
              backgroundImage: wpBg,
              backgroundSize: "cover",
              backgroundAttachment: "local",
            }
          : undefined
      }
    >
      {/* Header */}
      <header
        ref={headerRef}
        className="glass-thin relative z-10 flex shrink-0 items-center gap-3 px-3 py-2.5 sm:px-4"
      >
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
          <div className="flex min-w-0 items-center gap-1 truncate font-semibold">
            <span className="truncate">{name}</span>
            {conversation.type === "direct" &&
              conversation.other_member?.badges?.some((b) => b === "verified" || b === "admin") && (
                <VerifiedBadge size={14} />
              )}
            {isSectionLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {typingUsers.length > 0
              ? `${typingUsers.map((t) => t.name).join(", ")} typing…`
              : subtitle}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent/10"
          aria-label="Search in chat"
        >
          <SearchIcon className="h-5 w-5" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent/10"
              aria-label="Chat options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-50">
            <DropdownMenuItem onClick={() => setSearchOpen(true)}>
              <SearchIcon className="mr-2 h-4 w-4" /> Search in chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setWpOpen(true)}>
              <ImageIcon className="mr-2 h-4 w-4" /> Change wallpaper
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <ChatSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        messages={messages}
        onJump={jumpToMessage}
      />

      <PinnedBanner
        conversationId={conversation.id}
        pinnedMessageId={pinnedId}
        isAdmin={isAdmin}
        isCreator={true}
        onJump={jumpToMessage}
      />

      {/* Messages */}
      <div ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-3 sm:py-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand shadow-elegant">
              <MessageCircle className="h-8 w-8 text-primary-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">No messages yet — say hi 👋</p>
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
                    conversationId={conversation.id}
                    otherMembersCount={otherMembersCount}
                    isAdmin={isAdmin}
                    onReply={setReplyTo}
                    onReact={react}
                    onDelete={del}
                    onForward={forward}
                    isBlocked={isBlocked}
                    onBlock={block}
                    onOpenImage={openImage}
                  />
                </div>
              );
            })}
            {typingUsers.length > 0 && (
              <div className="px-4 py-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="flex gap-0.5">
                    <span
                      className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground"
                      style={{ animationDelay: "300ms" }}
                    />
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
        <div className="glass-thin flex shrink-0 items-center justify-center gap-2 px-4 py-3 text-xs text-muted-foreground">
          <Megaphone className="h-3.5 w-3.5" />
          Only admins can post in this announcement channel.
        </div>
      )}

      {user && (
        <WallpaperPicker
          open={wpOpen}
          onOpenChange={setWpOpen}
          conversationId={conversation.id}
          userId={user.id}
          current={wallpaper}
          onSaved={(wp) => setWallpaper(wp)}
        />
      )}
      <ImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        images={imageUrls}
        startIndex={lightboxIndex}
      />
    </section>
  );
}
