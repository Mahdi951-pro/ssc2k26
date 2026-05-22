// Web Push sender — invoked by DB trigger on new messages.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VAPID_PUBLIC = "BA0PM_mM9k7jasHXl7rnna3JVO_gukNNIRKVh5UUt2ni_ARYIN9Gc4vymtGM1lQSJk8AB8J8FPjbsne8rqlaJ3o";
const VAPID_PRIVATE = "_TjgQ0GZYy4RmGdcjiWf2x_evoq5k366QujQfcq2dMU";
const VAPID_SUBJECT = "mailto:notifications@ssc2k26.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function previewFor(msg: any): string {
  switch (msg.type) {
    case "image": return "📷 Photo";
    case "video": return "🎬 Video";
    case "audio":
    case "voice": return "🎙️ Voice message";
    case "file": return "📎 File";
    case "poll": return "📊 Poll";
    default: return (msg.content || "New message").toString().slice(0, 140);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Public key endpoint
  if (req.method === "GET") {
    return new Response(JSON.stringify({ publicKey: VAPID_PUBLIC }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const { message_id } = await req.json();
    if (!message_id) return new Response("missing message_id", { status: 400, headers: cors });

    const { data: msg } = await supabase
      .from("messages").select("*").eq("id", message_id).maybeSingle();
    if (!msg) return new Response("no msg", { status: 200, headers: cors });

    const { data: conv } = await supabase
      .from("conversations").select("id, name, type, avatar_url").eq("id", msg.conversation_id).maybeSingle();

    const { data: sender } = await supabase
      .from("profiles").select("user_id, display_name, avatar_url").eq("user_id", msg.sender_id).maybeSingle();

    // Recipients: all conversation members except sender, excluding muted
    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id, is_muted")
      .eq("conversation_id", msg.conversation_id);
    const recipients = (members || [])
      .filter((m: any) => m.user_id !== msg.sender_id && !m.is_muted)
      .map((m: any) => m.user_id);
    if (recipients.length === 0) return new Response("no recipients", { headers: cors });

    const { data: subs } = await supabase
      .from("push_subscriptions").select("*").in("user_id", recipients);
    if (!subs || subs.length === 0) return new Response("no subs", { headers: cors });

    const senderName = sender?.display_name || "Someone";
    const isGroup = conv && conv.type !== "direct";
    const title = isGroup ? `${senderName} • ${conv?.name || "Group"}` : senderName;
    const body = previewFor(msg);
    const icon = sender?.avatar_url || conv?.avatar_url || "/icon-192.png";

    const payload = JSON.stringify({
      title,
      body,
      icon,
      tag: `conv-${msg.conversation_id}`,
      url: "/chat",
      conversationId: msg.conversation_id,
    });

    const results = await Promise.allSettled(
      subs.map((s: any) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24 },
        ),
      ),
    );

    // Clean up expired/invalid subscriptions
    const expired: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const code = (r.reason as any)?.statusCode;
        if (code === 404 || code === 410) expired.push(subs[i].endpoint);
      }
    });
    if (expired.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", expired);
    }

    return new Response(JSON.stringify({ sent: subs.length, expired: expired.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
