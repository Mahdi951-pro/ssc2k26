import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Megaphone, Trash2, Power, PowerOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  body: string;
  target_section: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export function AnnouncementsTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [section, setSection] = useState<"" | "A" | "B">("");

  const load = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Announcement[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!user) return;
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: body.trim(),
      target_section: section || null,
      created_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Broadcast sent!");
    setTitle(""); setBody(""); setSection("");
    load();
  };

  const toggle = async (a: Announcement) => {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: !a.is_active })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="mt-3 space-y-4">
      {/* Composer */}
      <div className="rounded-xl border border-border/50 bg-card/60 p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Megaphone className="h-4 w-4" /> New broadcast
        </div>
        <Input
          placeholder="Title (e.g. Class postponed)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        <Textarea
          placeholder="Message body..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          rows={3}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Target:</span>
          {(["", "A", "B"] as const).map((s) => (
            <Button
              key={s || "all"}
              size="sm"
              variant={section === s ? "default" : "outline"}
              onClick={() => setSection(s)}
              className={`h-7 ${section === s ? "bg-gradient-brand text-primary-foreground" : ""}`}
            >
              {s ? `Section ${s}` : "Everyone"}
            </Button>
          ))}
          <Button
            size="sm"
            disabled={busy}
            onClick={submit}
            className="ml-auto bg-gradient-brand text-primary-foreground"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send broadcast"}
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No announcements yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="rounded-xl border border-border/50 bg-card/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {a.title}
                    {a.target_section && (
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                        {a.target_section}
                      </span>
                    )}
                    {!a.is_active && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-xs text-foreground/80">{a.body}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggle(a)}>
                    {a.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
