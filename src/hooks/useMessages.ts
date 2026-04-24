import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: "text" | "image" | "file" | "voice" | "system";
  media_url: string | null;
  reply_to: string | null;
  forwarded_from: string | null;
  deleted_for_everyone: boolean | null;
  deleted_for_users: string[] | null;
  created_at: string;
  edited_at: string | null;
  // joined
  sender?: { display_name: string; avatar_url: string | null } | null;
  reactions?: { emoji: string; user_id: string }[];
  reply_message?: { content: string | null; sender_id: string } | null;
}

export function useMessages(conversationId: string | undefined, currentUserId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const profilesCache = useRef<Map<string, { display_name: string; avatar_url: string | null }>>(
    new Map()
  );

  const fetchProfile = useCallback(async (uid: string) => {
    if (profilesCache.current.has(uid)) return profilesCache.current.get(uid)!;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", uid)
      .maybeSingle();
    const p = data ?? { display_name: "Unknown", avatar_url: null };
    profilesCache.current.set(uid, p);
    return p;
  }, []);

  const enrich = useCallback(
    async (msgs: Message[]) => {
      const enriched = await Promise.all(
        msgs.map(async (m) => {
          const sender = await fetchProfile(m.sender_id);
          let reply_message = null;
          if (m.reply_to) {
            const { data } = await supabase
              .from("messages")
              .select("content, sender_id")
              .eq("id", m.reply_to)
              .maybeSingle();
            reply_message = data;
          }
          const { data: reactions } = await supabase
            .from("message_reactions")
            .select("emoji, user_id")
            .eq("message_id", m.id);
          return { ...m, sender, reactions: reactions ?? [], reply_message };
        })
      );
      return enriched;
    },
    [fetchProfile]
  );

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    const enriched = await enrich((data ?? []) as Message[]);
    setMessages(enriched);
    setLoading(false);

    // Mark read
    if (currentUserId) {
      await supabase
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", currentUserId);
    }
  }, [conversationId, enrich, currentUserId]);

  useEffect(() => {
    setMessages([]);
    load();
  }, [load]);

  // Realtime
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`msgs-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const m = payload.new as Message;
          const [enriched] = await enrich([m]);
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, enriched]));
          if (currentUserId && m.sender_id !== currentUserId) {
            await supabase
              .from("conversation_members")
              .update({ last_read_at: new Date().toISOString() })
              .eq("conversation_id", conversationId)
              .eq("user_id", currentUserId);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) =>
            prev.map((p) => (p.id === m.id ? { ...p, ...m } : p))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        async (payload) => {
          const mid = (payload.new as any)?.message_id || (payload.old as any)?.message_id;
          if (!mid) return;
          const { data: reactions } = await supabase
            .from("message_reactions")
            .select("emoji, user_id")
            .eq("message_id", mid);
          setMessages((prev) =>
            prev.map((p) => (p.id === mid ? { ...p, reactions: reactions ?? [] } : p))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, enrich, currentUserId]);

  return { messages, loading, refresh: load };
}
