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
  sender?: { display_name: string; avatar_url: string | null; badges?: string[] | null } | null;
  reactions?: { emoji: string; user_id: string }[];
  reply_message?: { content: string | null; sender_id: string } | null;
  read_by?: string[];
}

export function useMessages(conversationId: string | undefined, currentUserId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const loadSeq = useRef(0);
  const profilesCache = useRef<
    Map<string, { display_name: string; avatar_url: string | null; badges: string[] | null }>
  >(new Map());

  const fetchProfile = useCallback(async (uid: string) => {
    if (profilesCache.current.has(uid)) return profilesCache.current.get(uid)!;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, badges")
      .eq("user_id", uid)
      .maybeSingle();
    const p = data ?? { display_name: "Unknown", avatar_url: null, badges: null };
    profilesCache.current.set(uid, p);
    return p;
  }, []);

  const enrich = useCallback(
    async (msgs: Message[]) => {
      const ids = msgs.map((m) => m.id);
      const [reactionsRes, readsRes] = ids.length
        ? await Promise.all([
            supabase.from("message_reactions").select("message_id, emoji, user_id").in("message_id", ids),
            supabase.from("message_reads").select("message_id, user_id").in("message_id", ids),
          ])
        : [{ data: [] as any[] }, { data: [] as any[] }];
      const rxByMsg = new Map<string, { emoji: string; user_id: string }[]>();
      (reactionsRes.data ?? []).forEach((r: any) => {
        const arr = rxByMsg.get(r.message_id) ?? [];
        arr.push({ emoji: r.emoji, user_id: r.user_id });
        rxByMsg.set(r.message_id, arr);
      });
      const readsByMsg = new Map<string, string[]>();
      (readsRes.data ?? []).forEach((r: any) => {
        const arr = readsByMsg.get(r.message_id) ?? [];
        arr.push(r.user_id);
        readsByMsg.set(r.message_id, arr);
      });

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
          return {
            ...m,
            sender,
            reactions: rxByMsg.get(m.id) ?? [],
            read_by: readsByMsg.get(m.id) ?? [],
            reply_message,
          };
        })
      );
      return enriched;
    },
    [fetchProfile]
  );

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const seq = ++loadSeq.current;
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (seq !== loadSeq.current) return;
    if (error) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const enriched = await enrich((data ?? []) as Message[]);
    if (seq !== loadSeq.current) return;
    setMessages(enriched);
    setLoading(false);

    // Mark conversation read + record per-message reads for ticks
    if (currentUserId) {
      await (supabase.rpc as any)("mark_conversation_read", { _conversation: conversationId });
      const incoming = (enriched as Message[]).filter(
        (m) => m.sender_id !== currentUserId && !(m.read_by ?? []).includes(currentUserId),
      );
      if (incoming.length) {
        await supabase
          .from("message_reads")
          .upsert(
            incoming.map((m) => ({ message_id: m.id, user_id: currentUserId })),
            { onConflict: "message_id,user_id", ignoreDuplicates: true },
          );
      }
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
      .channel(`msgs-${conversationId}-${Math.random().toString(36).slice(2)}`)
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
            await (supabase.rpc as any)("mark_conversation_read", { _conversation: conversationId });
            await supabase
              .from("message_reads")
              .upsert(
                [{ message_id: m.id, user_id: currentUserId }],
                { onConflict: "message_id,user_id", ignoreDuplicates: true },
              );
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "message_reads" },
        (payload) => {
          const mid = (payload.new as any)?.message_id;
          const uid = (payload.new as any)?.user_id;
          if (!mid || !uid) return;
          setMessages((prev) =>
            prev.map((p) =>
              p.id === mid && !(p.read_by ?? []).includes(uid)
                ? { ...p, read_by: [...(p.read_by ?? []), uid] }
                : p,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, enrich, currentUserId]);

  return { messages, loading, refresh: load };
}
