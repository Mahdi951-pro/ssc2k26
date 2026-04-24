import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { BarChart3, Loader2 } from "lucide-react";

interface Props {
  pollId: string;
}

interface Poll {
  id: string;
  question: string;
  options: string[];
  multi_choice: boolean;
  is_anonymous: boolean;
  created_by: string;
}

export function PollCard({ pollId }: Props) {
  const { user } = useAuth();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<{ user_id: string; option_index: number }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: p } = await supabase.from("polls").select("*").eq("id", pollId).maybeSingle();
    if (p) {
      setPoll({
        id: p.id,
        question: p.question,
        options: (p.options as string[]) || [],
        multi_choice: !!p.multi_choice,
        is_anonymous: !!p.is_anonymous,
        created_by: p.created_by,
      });
    }
    const { data: v } = await supabase
      .from("poll_votes")
      .select("user_id, option_index")
      .eq("poll_id", pollId);
    setVotes(v ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`poll-${pollId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollId]);

  const total = votes.length;
  const counts = useMemo(() => {
    const c: number[] = poll ? new Array(poll.options.length).fill(0) : [];
    votes.forEach((v) => {
      if (v.option_index >= 0 && v.option_index < c.length) c[v.option_index] += 1;
    });
    return c;
  }, [votes, poll]);

  const myVotes = useMemo(
    () => new Set(votes.filter((v) => v.user_id === user?.id).map((v) => v.option_index)),
    [votes, user]
  );

  const vote = async (i: number) => {
    if (!user || !poll) return;
    setBusy(true);
    if (myVotes.has(i)) {
      await supabase
        .from("poll_votes")
        .delete()
        .eq("poll_id", poll.id)
        .eq("user_id", user.id)
        .eq("option_index", i);
    } else {
      if (!poll.multi_choice && myVotes.size > 0) {
        await supabase.from("poll_votes").delete().eq("poll_id", poll.id).eq("user_id", user.id);
      }
      await supabase.from("poll_votes").insert({
        poll_id: poll.id,
        user_id: user.id,
        option_index: i,
      });
    }
    setBusy(false);
  };

  if (!poll) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading poll…
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-2 rounded-2xl border border-border/50 bg-card/70 p-3 backdrop-blur">
      <div className="flex items-start gap-2">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1">
          <div className="font-semibold leading-snug">{poll.question}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {total} {total === 1 ? "vote" : "votes"}
            {poll.multi_choice && " · multi-choice"}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {poll.options.map((opt, i) => {
          const pct = total ? Math.round((counts[i] / total) * 100) : 0;
          const mine = myVotes.has(i);
          return (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => vote(i)}
              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                mine ? "border-primary/70 bg-primary/10" : "border-border/50 bg-background/40 hover:bg-accent/10"
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/25 to-accent/15 transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className={mine ? "font-medium" : ""}>{opt}</span>
                <span className="text-xs text-muted-foreground">{pct}% · {counts[i]}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
