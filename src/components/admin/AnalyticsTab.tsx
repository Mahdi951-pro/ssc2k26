import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, MessageSquare, UserPlus, Activity } from "lucide-react";

interface Series {
  date: string;
  messages: number;
  signups: number;
}

export function AnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<Series[]>([]);
  const [totals, setTotals] = useState({ msgs7: 0, signups7: 0, active7: 0, avgPerDay: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const days: Series[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        const [{ count: m }, { count: s }] = await Promise.all([
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .gte("created_at", d.toISOString())
            .lt("created_at", next.toISOString()),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .gte("created_at", d.toISOString())
            .lt("created_at", next.toISOString()),
        ]);
        days.push({
          date: d.toLocaleDateString(undefined, { weekday: "short" }),
          messages: m ?? 0,
          signups: s ?? 0,
        });
      }
      const msgs7 = days.reduce((a, b) => a + b.messages, 0);
      const signups7 = days.reduce((a, b) => a + b.signups, 0);
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { count: active7 } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .gte("last_seen", since.toISOString());

      setSeries(days);
      setTotals({ msgs7, signups7, active7: active7 ?? 0, avgPerDay: Math.round(msgs7 / 7) });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const maxMsg = Math.max(1, ...series.map((s) => s.messages));

  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={<MessageSquare className="h-4 w-4" />} label="Messages · 7d" value={totals.msgs7} />
        <MiniStat icon={<UserPlus className="h-4 w-4" />} label="Signups · 7d" value={totals.signups7} />
        <MiniStat icon={<Activity className="h-4 w-4" />} label="Active · 7d" value={totals.active7} />
        <MiniStat icon={<TrendingUp className="h-4 w-4" />} label="Msgs/day avg" value={totals.avgPerDay} />
      </div>
      <div className="rounded-xl border border-border/50 bg-card/60 p-4">
        <div className="mb-3 text-sm font-semibold">Messages · last 7 days</div>
        <div className="flex items-end gap-2 h-40">
          {series.map((s, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-brand transition-all"
                  style={{ height: `${(s.messages / maxMsg) * 100}%`, minHeight: s.messages > 0 ? "4px" : "0" }}
                  title={`${s.messages} messages`}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">{s.date}</div>
              <div className="text-xs font-semibold tabular-nums">{s.messages}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
