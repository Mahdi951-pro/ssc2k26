import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, ArrowLeft, Users, MessageSquare, Flag, BarChart3, Trash2, Check, Megaphone, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { UsersTab } from "@/components/admin/UsersTab";
import { ActiveUsersTab } from "@/components/admin/ActiveUsersTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { AnnouncementsTab } from "@/components/admin/AnnouncementsTab";

export const Route = createFileRoute("/admin")({
  component: AdminRoute,
  head: () => ({
    meta: [
      { title: "Admin — SSC 2k26" },
      { name: "description", content: "Moderation and analytics dashboard." },
    ],
  }),
});

interface Stats {
  users: number;
  online: number;
  messagesToday: number;
  conversations: number;
  pendingReports: number;
}

interface ReportRow {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter_id: string;
  reported_user_id: string | null;
  message_id: string | null;
  reporter?: { display_name: string } | null;
  reported?: { display_name: string } | null;
  message_content?: string | null;
}

function AdminRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const loadAll = async () => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const [u, online, msgs, conv, rep] = await Promise.all([
      supabase.from("profiles").select("user_id", { count: "exact", head: true }),
      supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("is_online", true),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since.toISOString()),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setStats({
      users: u.count ?? 0,
      online: online.count ?? 0,
      messagesToday: msgs.count ?? 0,
      conversations: conv.count ?? 0,
      pendingReports: rep.count ?? 0,
    });

    const { data: rows } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (rows) {
      const enriched: ReportRow[] = await Promise.all(
        rows.map(async (r: any) => {
          const [{ data: rep }, { data: rd }, { data: msg }] = await Promise.all([
            supabase.from("profiles").select("display_name").eq("user_id", r.reporter_id).maybeSingle(),
            r.reported_user_id
              ? supabase.from("profiles").select("display_name").eq("user_id", r.reported_user_id).maybeSingle()
              : Promise.resolve({ data: null }),
            r.message_id
              ? supabase.from("messages").select("content").eq("id", r.message_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          return {
            ...r,
            reporter: rep,
            reported: rd,
            message_content: msg?.content ?? null,
          };
        })
      );
      setReports(enriched);
    }
  };

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  const resolveReport = async (id: string, status: "resolved" | "dismissed") => {
    setBusy(true);
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Report ${status}`);
    loadAll();
  };

  const deleteMessage = async (mid: string) => {
    if (!confirm("Delete this message for everyone?")) return;
    const { error } = await supabase
      .from("messages")
      .update({ deleted_for_everyone: true, content: null, media_url: null })
      .eq("id", mid);
    if (error) return toast.error(error.message);
    toast.success("Message deleted");
    loadAll();
  };

  if (loading || isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Admins only</h1>
        <p className="text-sm text-muted-foreground">
          You need admin privileges to access this page.
        </p>
        <Link to="/chat">
          <Button variant="outline">Back to chat</Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="aurora min-h-screen">
      <div className="relative z-10 mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <header className="glass flex items-center gap-3 rounded-2xl p-4">
          <Link to="/chat">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Admin dashboard</h1>
            <p className="text-xs text-muted-foreground">SSC 2k26 moderation & analytics</p>
          </div>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard icon={<Users className="h-4 w-4" />} label="Users" value={stats?.users ?? 0} />
          <StatCard icon={<span className="h-2 w-2 rounded-full bg-success" />} label="Online" value={stats?.online ?? 0} />
          <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Messages today" value={stats?.messagesToday ?? 0} />
          <StatCard icon={<BarChart3 className="h-4 w-4" />} label="Conversations" value={stats?.conversations ?? 0} />
          <StatCard
            icon={<Flag className="h-4 w-4" />}
            label="Pending reports"
            value={stats?.pendingReports ?? 0}
            highlight={(stats?.pendingReports ?? 0) > 0}
          />
        </section>

        {/* Reports */}
        <Tabs defaultValue="pending" className="glass rounded-2xl p-4">
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="all">All reports</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">
            <ReportList
              rows={reports.filter((r) => r.status === "pending")}
              onResolve={resolveReport}
              onDeleteMessage={deleteMessage}
              busy={busy}
            />
          </TabsContent>
          <TabsContent value="all">
            <ReportList
              rows={reports}
              onResolve={resolveReport}
              onDeleteMessage={deleteMessage}
              busy={busy}
            />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`glass rounded-2xl p-4 transition-all hover:scale-[1.02] ${
        highlight ? "ring-2 ring-destructive/40" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ReportList({
  rows,
  onResolve,
  onDeleteMessage,
  busy,
}: {
  rows: ReportRow[];
  onResolve: (id: string, status: "resolved" | "dismissed") => void;
  onDeleteMessage: (mid: string) => void;
  busy: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        No reports here. Everything's calm 🌿
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-border/50 bg-card/60 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{r.reason}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Reported by <strong>{r.reporter?.display_name || "—"}</strong>
                {r.reported?.display_name && (
                  <>
                    {" "}· against <strong>{r.reported.display_name}</strong>
                  </>
                )}{" "}
                · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </div>
              {r.message_content && (
                <blockquote className="mt-2 rounded-md border-l-2 border-primary bg-muted/40 px-2 py-1 text-xs italic">
                  "{r.message_content.slice(0, 200)}"
                </blockquote>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  r.status === "pending"
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                    : r.status === "resolved"
                      ? "bg-success/20 text-success"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {r.status}
              </span>
            </div>
          </div>
          {r.status === "pending" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {r.message_id && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onDeleteMessage(r.message_id!)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete message
                </Button>
              )}
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onResolve(r.id, "resolved")}
                className="bg-gradient-brand text-primary-foreground"
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Resolve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onResolve(r.id, "dismissed")}
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
