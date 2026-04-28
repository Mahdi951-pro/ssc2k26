import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Row {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  section: string | null;
  is_online: boolean | null;
  last_seen: string | null;
}

export function ActiveUsersTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, section, is_online, last_seen")
      .order("is_online", { ascending: false })
      .order("last_seen", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-presence")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, load)
      .subscribe();
    const iv = setInterval(load, 30_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(iv);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const online = rows.filter((r) => r.is_online);
  const recent = rows.filter((r) => !r.is_online);

  return (
    <div className="mt-3 space-y-4">
      <Section title={`🟢 Online now (${online.length})`} rows={online} />
      <Section title={`Recently seen`} rows={recent.slice(0, 30)} />
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.user_id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 p-2.5">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
              {r.avatar_url ? (
                <img src={r.avatar_url} className="h-full w-full object-cover" alt="" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                  {r.display_name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              {r.is_online && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.display_name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {r.is_online
                  ? "online"
                  : r.last_seen
                    ? formatDistanceToNow(new Date(r.last_seen), { addSuffix: true })
                    : "never"}
                {r.section && ` · ${r.section}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
