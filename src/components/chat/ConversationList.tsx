import { useState, useEffect } from "react";
import { Conversation, useConversations } from "@/hooks/useConversations";
import { SwipeableConversationItem } from "./SwipeableConversationItem";
import { Input } from "@/components/ui/input";
import {
  Search,
  MessageCircle,
  Plus,
  Settings,
  LogOut,
  Moon,
  Sun,
  Users,
  Loader2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/components/theme/ThemeProvider";
import { UserAvatar } from "./UserAvatar";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { BroadcastBanner } from "@/components/stories/BroadcastBanner";
import { NotificationPrompt } from "./NotificationPrompt";
import { ActionLiveProDialog } from "./ActionLiveProDialog";
import { Sparkles } from "lucide-react";

interface Props {
  selectedId: string | null;
  onSelect: (c: Conversation) => void;
  className?: string;
  onOpenProfile: () => void;
}

export function ConversationList({ selectedId, onSelect, className = "", onOpenProfile }: Props) {
  const { user, signOut } = useAuth();
  const { conversations, loading, refresh } = useConversations(user?.id);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "unread" | "groups">("all");
  const [aiOpen, setAiOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<{
    display_name: string;
    avatar_url: string | null;
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const totalUnread = conversations.reduce((n, c) => n + (c.unread_count ?? 0), 0);
  const groupCount = conversations.filter((c) => c.type !== "direct").length;

  const filtered = conversations.filter((c) => {
    if (tab === "unread" && (c.unread_count ?? 0) === 0) return false;
    if (tab === "groups" && c.type === "direct") return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const name = c.type === "direct" ? c.other_member?.display_name : c.name;
    return (name || "").toLowerCase().includes(q);
  });

  return (
    <aside
      className={`glass-thin flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-sidebar-border ${className}`}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar-border/50 px-3 py-2.5 sm:px-4 sm:py-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex min-w-0 items-center gap-2 rounded-lg p-1 transition-colors hover:bg-sidebar-accent"
        >
          <UserAvatar name={profile?.display_name} url={profile?.avatar_url} size={36} />
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-semibold">{profile?.display_name || "You"}</div>
            <div className="text-[10px] text-muted-foreground">Online</div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <NewChatDialog
            onCreated={(conversation) => {
              refresh();
              onSelect(conversation);
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="h-9 w-9 rounded-full"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                aria-label="Menu"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              <DropdownMenuItem onClick={onOpenProfile}>Profile settings</DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="flex w-full items-center">
                    <Shield className="mr-2 h-4 w-4" /> Admin dashboard
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  toast.success("Signed out");
                }}
                className="text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Broadcasts */}
      <BroadcastBanner />

      <NotificationPrompt />

      {/* Stories */}
      <StoriesBar />

      {/* Search */}
      <div className="shrink-0 border-b border-sidebar-border p-2.5 sm:p-3">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask ActionLivePro or search"
              className="h-10 rounded-full border-transparent bg-sidebar-accent pl-9 pr-3 text-base focus-visible:bg-background sm:h-9 sm:text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            aria-label="Open ActionLivePro AI"
            className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-brand shadow-soft transition-transform active:scale-95 sm:h-9 sm:w-9"
          >
            <Sparkles className="h-4 w-4 text-primary-foreground" />
            <span className="absolute inset-0 rounded-full bg-gradient-brand opacity-50 blur-md transition-opacity group-hover:opacity-80" />
            <Sparkles className="relative h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>

      <ActionLiveProDialog open={aiOpen} onOpenChange={setAiOpen} />

      {/* Filter tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-sidebar-border/60 px-2 pb-2 [scrollbar-width:none]">
        {([
          { id: "all", label: "All", badge: 0 },
          { id: "unread", label: "Unread", badge: totalUnread },
          { id: "groups", label: "Groups", badge: groupCount },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-gradient-brand text-primary-foreground shadow-soft"
                : "bg-sidebar-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  tab === t.id ? "bg-white/25" : "bg-primary/15 text-primary"
                }`}
              >
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 sm:p-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {tab === "unread" ? "All caught up ✨" : "No chats here"}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((c) => (
              <SwipeableConversationItem
                key={c.id}
                conversation={c}
                active={selectedId === c.id}
                currentUserId={user!.id}
                onClick={() => onSelect(c)}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>

      {/* Creator signature */}
      <div className="shrink-0 border-t border-sidebar-border/60 px-4 py-2 text-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <p className="text-[10px] tracking-wide text-muted-foreground">
          Built by{" "}
          <span className="bg-gradient-brand bg-clip-text font-semibold text-transparent">
            Abid
          </span>{" "}
          · SSC&nbsp;2k26
        </p>
      </div>
    </aside>
  );
}

function NewChatDialog({ onCreated }: { onCreated: (conversation: Conversation) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<
    {
      user_id: string;
      display_name: string;
      avatar_url: string | null;
      is_online: boolean | null;
    }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, is_online")
      .neq("user_id", user.id)
      .order("display_name")
      .limit(100)
      .then(({ data }) => setPeople(data || []));
  }, [open, user]);

  const startDM = async (otherId: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const other = people.find((p) => p.user_id === otherId);
      const { data: rpcId, error } = await supabase.rpc("get_or_create_direct_conversation", {
        _other: otherId,
      });
      if (error) throw error;
      const convId = rpcId as unknown as string;
      const { data: convRow, error: convError } = await supabase
        .from("conversations")
        .select("id, type, name, description, avatar_url, last_message_at, is_default")
        .eq("id", convId)
        .single();
      if (convError || !convRow) throw convError || new Error("Could not open chat");

      onCreated({
        ...(convRow as Conversation),
        is_pinned: false,
        is_muted: false,
        last_read_at: new Date().toISOString(),
        other_member: other
          ? {
              user_id: other.user_id,
              display_name: other.display_name,
              username: null,
              avatar_url: other.avatar_url,
              is_online: !!other.is_online,
              last_seen: null,
              bio: null,
              badges: null,
              privacy_show_online: true,
            }
          : null,
      });
      setOpen(false);
      toast.success("Chat opened");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not start chat");
    } finally {
      setBusy(false);
    }
  };

  const filtered = people.filter(
    (p) => !search.trim() || p.display_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="New chat">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Start a new chat
          </DialogTitle>
        </DialogHeader>
        <div className="p-3">
          <Input
            placeholder="Search batchmates"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-80 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No batchmates yet</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.user_id}
                disabled={busy}
                onClick={() => startDM(p.user_id)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent/10"
              >
                <UserAvatar
                  name={p.display_name}
                  url={p.avatar_url}
                  online={!!p.is_online}
                  showStatus
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.is_online ? "Online" : "Offline"}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
