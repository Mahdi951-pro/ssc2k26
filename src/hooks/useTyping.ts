import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useTyping(conversationId: string | undefined, currentUserId: string | undefined) {
  const [typingUsers, setTypingUsers] = useState<{ user_id: string; name: string }[]>([]);
  const lastSent = useRef(0);

  // Subscribe
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`typing-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async () => {
          const cutoff = new Date(Date.now() - 4000).toISOString();
          const { data } = await supabase
            .from("typing_indicators")
            .select("user_id, profiles!inner(display_name)")
            .eq("conversation_id", conversationId)
            .gte("updated_at", cutoff);
          setTypingUsers(
            (data || [])
              .filter((d: any) => d.user_id !== currentUserId)
              .map((d: any) => ({ user_id: d.user_id, name: d.profiles?.display_name || "Someone" }))
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, currentUserId]);

  // Auto-clear stale
  useEffect(() => {
    const i = setInterval(() => {
      setTypingUsers((prev) => prev.filter(() => true)); // trigger react
    }, 2000);
    return () => clearInterval(i);
  }, []);

  const sendTyping = useCallback(async () => {
    if (!conversationId || !currentUserId) return;
    const now = Date.now();
    if (now - lastSent.current < 1500) return;
    lastSent.current = now;
    await supabase
      .from("typing_indicators")
      .upsert(
        { conversation_id: conversationId, user_id: currentUserId, updated_at: new Date().toISOString() },
        { onConflict: "conversation_id,user_id" }
      );
  }, [conversationId, currentUserId]);

  return { typingUsers, sendTyping };
}
