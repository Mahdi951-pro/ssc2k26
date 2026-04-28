import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Shield, ShieldOff, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface UserRow {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  section: string | null;
  is_online: boolean | null;
  last_seen: string | null;
  is_admin?: boolean;
}

export function UsersTab() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: admins }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, section, is_online, last_seen")
        .order("display_name")
        .limit(500),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const adminSet = new Set((admins ?? []).map((a: any) => a.user_id));
    setRows(
      (profiles ?? []).map((p: any) => ({ ...p, is_admin: adminSet.has(p.user_id) }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleAdmin = async (u: UserRow) => {
    setBusy(u.user_id);
    if (u.is_admin) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", u.user_id)
        .eq("role", "admin");
      if (error) toast.error(error.message);
      else toast.success(`${u.display_name} is no longer an admin`);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: u.user_id, role: "admin" });
      if (error) toast.error(error.message);
      else toast.success(`${u.display_name} promoted to admin`);
    }
    setBusy(null);
    load();
  };

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.display_name?.toLowerCase().includes(q) ||
      r.username?.toLowerCase().includes(q) ||
      r.section?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mt-3 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, username, or section..."
          className="pl-9"
        />
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <div
              key={u.user_id}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 p-3"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                    {u.display_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                {u.is_online && (
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="truncate">{u.display_name}</span>
                  {u.is_admin && (
                    <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                      ADMIN
                    </span>
                  )}
                  {u.section && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                      {u.section}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  @{u.username ?? "—"} ·{" "}
                  {u.is_online
                    ? "online"
                    : u.last_seen
                      ? `seen ${formatDistanceToNow(new Date(u.last_seen), { addSuffix: true })}`
                      : "never"}
                </div>
              </div>
              <Button
                size="sm"
                variant={u.is_admin ? "outline" : "default"}
                disabled={busy === u.user_id}
                onClick={() => toggleAdmin(u)}
                className={u.is_admin ? "" : "bg-gradient-brand text-primary-foreground"}
              >
                {busy === u.user_id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : u.is_admin ? (
                  <>
                    <ShieldOff className="mr-1 h-3.5 w-3.5" /> Demote
                  </>
                ) : (
                  <>
                    <Shield className="mr-1 h-3.5 w-3.5" /> Make admin
                  </>
                )}
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No users match "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
