import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Megaphone, X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  target_section: string | null;
  created_at: string;
}

const DISMISS_KEY = "ssc_dismissed_announcements";

export function BroadcastBanner() {
  const { user } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"));
    } catch { return new Set(); }
  });
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("section")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setSection(data?.section ?? null));
  }, [user]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);
      setItems((data ?? []) as Announcement[]);
    };
    load();
    const ch = supabase
      .channel("announcements-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const visible = items.filter((a) => {
    if (dismissed.has(a.id)) return false;
    if (a.target_section && section && a.target_section.toUpperCase() !== section.toUpperCase()) return false;
    return true;
  });

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(next)));
  };

  if (visible.length === 0) return null;

  return (
    <div className="space-y-1.5 px-3 pt-3">
      {visible.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-2 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 p-3 shadow-soft animate-fade-in-up"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground">
            <Megaphone className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-bold">
              {a.title}
              {a.target_section && (
                <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                  Section {a.target_section}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-foreground/80 whitespace-pre-wrap">{a.body}</div>
          </div>
          <button
            onClick={() => dismiss(a.id)}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-background/60"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
