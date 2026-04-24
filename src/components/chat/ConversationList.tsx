import { useState, useEffect } from "react";
import { Conversation, useConversations } from "@/hooks/useConversations";
import { ConversationItem } from "./ConversationItem";
import { Input } from "@/components/ui/input";
import { Search, MessageCircle, Plus, Settings, LogOut, Moon, Sun, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTheme } from "@/components/theme/ThemeProvider";
import { UserAvatar } from "./UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<{ display_name: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  const filtered = conversations.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const name = c.type === "direct" ? c.other_member?.display_name : c.name;
    return (name || "").toLowerCase().includes(q);
  });

  return (
    <aside
      className={`flex h-full flex-col border-r border-sidebar-border bg-sidebar ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-4 py-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-sidebar-accent"
        >
          <UserAvatar name={profile?.display_name} url={profile?.avatar_url} size={36} />
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-semibold">{profile?.display_name || "You"}</div>
            <div className="text-[10px] text-muted-foreground">Online</div>
          </div>
        </button>
        <div className="flex items-center gap-0.5">
          <NewChatDialog onCreated={refresh} />
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
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Menu">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              <DropdownMenuItem onClick={onOpenProfile}>
                Profile settings
              </DropdownMenuItem>
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

      {/* Search */}
      <div className="border-b border-sidebar-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="h-9 rounded-full border-transparent bg-sidebar-accent pl-9 focus-visible:bg-background"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No chats yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                active={selectedId === c.id}
                currentUserId={user!.id}
                onClick={() => onSelect(c)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function NewChatDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<{ user_id: string; display_name: string; avatar_url: string | null; is_online: boolean }[]>([]);
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
      // Check existing
      const { data: mine } = await supabase
        .from("conversation_members")
        .select("conversation_id, conversations!inner(type)")
        .eq("user_id", user.id);
      const myDirectIds = (mine || [])
        .filter((m: any) => m.conversations?.type === "direct")
        .map((m: any) => m.conversation_id);

      let existing: string | null = null;
      if (myDirectIds.length) {
        const { data: shared } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .in("conversation_id", myDirectIds)
          .eq("user_id", otherId);
        existing = shared?.[0]?.conversation_id || null;
      }

      let convId = existing;
      if (!convId) {
        const { data: newConv, error } = await supabase
          .from("conversations")
          .insert({ type: "direct", created_by: user.id })
          .select()
          .single();
        if (error) throw error;
        convId = newConv!.id;
        const { error: memErr } = await supabase
          .from("conversation_members")
          .insert([
            { conversation_id: convId, user_id: user.id },
            { conversation_id: convId, user_id: otherId },
          ]);
        if (memErr) throw memErr;
      }

      onCreated();
      setOpen(false);
      toast.success("Chat opened");
    } catch (e: any) {
      toast.error(e.message || "Could not start chat");
    } finally {
      setBusy(false);
    }
  };

  const filtered = people.filter((p) =>
    !search.trim() || p.display_name.toLowerCase().includes(search.toLowerCase())
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
                <UserAvatar name={p.display_name} url={p.avatar_url} online={p.is_online} showStatus size={40} />
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
