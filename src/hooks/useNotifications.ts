import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Options {
  userId: string | undefined;
  activeConversationId?: string | null;
}

interface MemberRow {
  conversation_id: string;
  is_muted: boolean | null;
}

interface ConvRow {
  id: string;
  name: string | null;
  type: string;
  avatar_url: string | null;
}

interface ProfileRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

let workerPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function getNotificationWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!workerPromise) {
    workerPromise = navigator.serviceWorker
      .register("/notification-sw.js", { scope: "/" })
      .then((registration) => registration)
      .catch(() => null);
  }
  return workerPromise;
}

function playPing() {
  try {
    // Web Audio synth — works without user gesture on mobile after first interaction
    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = (window as any).__notifCtx || new Ctx();
    (window as any).__notifCtx = ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.34);
  } catch {
    /* ignore */
  }
}

async function showBrowserNotification(title: string, body: string, icon?: string | null) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden) return; // toast handles foreground
  const options = {
    body: body.slice(0, 120),
    icon: icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: "ssc2k26-msg",
    renotify: true,
  } as NotificationOptions & { badge?: string; renotify?: boolean };
  const registration = await getNotificationWorker();
  if (registration?.showNotification) {
    await registration.showNotification(title, options).catch(() => {});
    return;
  }
  try {
    new Notification(title, options);
  } catch {
    /* ignore */
  }
}

export function useNotifications({ userId, activeConversationId }: Options) {
  const memberMapRef = useRef<Map<string, MemberRow>>(new Map());
  const convMapRef = useRef<Map<string, ConvRow>>(new Map());
  const profileCacheRef = useRef<Map<string, ProfileRow>>(new Map());
  const activeRef = useRef<string | null>(activeConversationId ?? null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeRef.current = activeConversationId ?? null;
  }, [activeConversationId]);

  // Ask permission once
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Request silently; browsers gate on user gesture but we attempt
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Load memberships + conversations
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("conversation_id, is_muted")
        .eq("user_id", userId);
      if (cancelled || !members) return;
      const ids = members.map((m: any) => m.conversation_id);
      memberMapRef.current = new Map(members.map((m: any) => [m.conversation_id, m]));
      if (!ids.length) return;
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, name, type, avatar_url")
        .in("id", ids);
      if (cancelled || !convs) return;
      convMapRef.current = new Map(convs.map((c: any) => [c.id, c]));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (!msg || !msg.id) return;
          if (seenRef.current.has(msg.id)) return;
          seenRef.current.add(msg.id);
          if (seenRef.current.size > 500) {
            // cap memory
            seenRef.current = new Set(Array.from(seenRef.current).slice(-200));
          }

          // Skip own messages
          if (msg.sender_id === userId) return;

          // Must belong to one of my conversations
          const member = memberMapRef.current.get(msg.conversation_id);
          if (!member) {
            // Maybe a freshly added conversation — refresh map and bail this round
            const { data: m } = await supabase
              .from("conversation_members")
              .select("conversation_id, is_muted")
              .eq("user_id", userId)
              .eq("conversation_id", msg.conversation_id)
              .maybeSingle();
            if (!m) return;
            memberMapRef.current.set(msg.conversation_id, m as any);
          }
          const refreshed = memberMapRef.current.get(msg.conversation_id);
          if (refreshed?.is_muted) return;

          // Skip if the conversation is currently open and tab is visible
          if (
            activeRef.current === msg.conversation_id &&
            typeof document !== "undefined" &&
            !document.hidden
          ) {
            return;
          }

          // Resolve sender profile (cached)
          let sender = profileCacheRef.current.get(msg.sender_id);
          if (!sender) {
            const { data: p } = await supabase
              .from("profiles")
              .select("user_id, display_name, avatar_url")
              .eq("user_id", msg.sender_id)
              .maybeSingle();
            if (p) {
              sender = p as ProfileRow;
              profileCacheRef.current.set(p.user_id, sender);
            }
          }

          // Resolve conversation
          let conv = convMapRef.current.get(msg.conversation_id);
          if (!conv) {
            const { data: c } = await supabase
              .from("conversations")
              .select("id, name, type, avatar_url")
              .eq("id", msg.conversation_id)
              .maybeSingle();
            if (c) {
              conv = c as ConvRow;
              convMapRef.current.set(c.id, conv);
            }
          }

          const senderName = sender?.display_name || "Someone";
          const isGroup = conv && conv.type !== "direct";
          const title = isGroup
            ? `${senderName} • ${conv?.name || "Group"}`
            : senderName;
          let preview = "";
          switch (msg.type) {
            case "image":
              preview = "📷 Photo";
              break;
            case "video":
              preview = "🎬 Video";
              break;
            case "audio":
              preview = "🎙️ Voice message";
              break;
            case "file":
              preview = "📎 File";
              break;
            case "poll":
              preview = "📊 Poll";
              break;
            default:
              preview = msg.content || "New message";
          }

          // In-app toast
          toast(title, {
            description: preview.length > 140 ? preview.slice(0, 140) + "…" : preview,
            duration: 4500,
          });

          // Native browser notification when tab is hidden
          showBrowserNotification(title, preview, sender?.avatar_url || conv?.avatar_url);

          // Sound
          playPing();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_members", filter: `user_id=eq.${userId}` },
        (payload) => {
          const m = payload.new as any;
          if (m?.conversation_id) {
            memberMapRef.current.set(m.conversation_id, m);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
