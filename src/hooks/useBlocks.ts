import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";

/** Hook: list of user_ids the current user has blocked. */
export function useBlocks() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id)
      .then(({ data }) => {
        if (!cancelled) setBlocked(new Set((data ?? []).map((d) => d.blocked_id)));
      });

    const ch = supabase
      .channel(`blocks-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_blocks", filter: `blocker_id=eq.${user.id}` },
        async () => {
          const { data } = await supabase
            .from("user_blocks")
            .select("blocked_id")
            .eq("blocker_id", user.id);
          setBlocked(new Set((data ?? []).map((d) => d.blocked_id)));
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const block = async (otherId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("user_blocks")
      .insert({ blocker_id: user.id, blocked_id: otherId });
    if (error) toast.error(error.message);
    else toast.success("User blocked");
  };

  const unblock = async (otherId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", otherId);
    if (error) toast.error(error.message);
    else toast.success("Unblocked");
  };

  return { blocked, block, unblock, isBlocked: (id: string) => blocked.has(id) };
}
