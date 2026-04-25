import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
  bio: string | null;
  badges: string[] | null;
  privacy_show_online: boolean | null;
}

export interface Conversation {
  id: string;
  type: "direct" | "group" | "announcement";
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  is_default: boolean | null;
  // joined
  is_pinned?: boolean;
  is_muted?: boolean;
  last_read_at?: string | null;
  other_member?: Profile | null;
  last_message?: { content: string | null; sender_id: string; created_at: string; type: string } | null;
  unread_count?: number;
}

export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Fetch memberships joined with conversations
    const { data: memberships, error } = await supabase
      .from("conversation_members")
      .select(
        "conversation_id, is_pinned, is_muted, last_read_at, conversations(id, type, name, description, avatar_url, last_message_at, is_default)"
      )
      .eq("user_id", userId);

    if (error || !memberships) {
      setLoading(false);
      return;
    }

    const convs: Conversation[] = [];

    for (const m of memberships as any[]) {
      const c = m.conversations;
      if (!c) continue;
      const conv: Conversation = {
        ...c,
        is_pinned: m.is_pinned,
        is_muted: m.is_muted,
        last_read_at: m.last_read_at,
      };

      if (c.type === "direct") {
        const { data: others } = await supabase
          .from("conversation_members")
          .select("user_id, profiles!inner(user_id, display_name, username, avatar_url, is_online, last_seen, bio, badges, privacy_show_online)")
          .eq("conversation_id", c.id)
          .neq("user_id", userId)
          .limit(1);
        conv.other_member = (others?.[0] as any)?.profiles ?? null;
      }

      // last message
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("content, sender_id, created_at, type")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);
      conv.last_message = lastMsg?.[0] ?? null;

      // unread count
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .gt("created_at", m.last_read_at || "1970-01-01")
        .neq("sender_id", userId);
      conv.unread_count = count ?? 0;

      convs.push(conv);
    }

    convs.sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
      const at = a.last_message?.created_at || a.last_message_at || "";
      const bt = b.last_message?.created_at || b.last_message_at || "";
      return bt.localeCompare(at);
    });

    setConversations(convs);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh on any new message
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`conv-list-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_members", filter: `user_id=eq.${userId}` }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  return { conversations, loading, refresh: load };
}
