import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Pin, BellOff, Bell, PinOff } from "lucide-react";
import { Conversation } from "@/hooks/useConversations";
import { ConversationItem } from "./ConversationItem";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  conversation: Conversation;
  active: boolean;
  currentUserId: string;
  onClick: () => void;
  onChanged: () => void;
}

const THRESHOLD = 70;

export function SwipeableConversationItem({
  conversation,
  active,
  currentUserId,
  onClick,
  onChanged,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    let startX = 0;
    let startY = 0;
    let active = false;
    let dx = 0;
    let locked: "x" | "y" | null = null;

    const onStart = (e: PointerEvent) => {
      // Ignore non-touch swipes on desktop to keep buttons clickable
      if (e.pointerType === "mouse") return;
      startX = e.clientX;
      startY = e.clientY;
      active = true;
      locked = null;
      gsap.killTweensOf(card);
    };
    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const ddx = e.clientX - startX;
      const ddy = e.clientY - startY;
      if (!locked) {
        if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return;
        locked = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y";
      }
      if (locked !== "x") return;
      dx = Math.max(-140, Math.min(140, ddx));
      gsap.set(card, { x: dx });
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      if (locked !== "x") return;
      const settle = Math.abs(dx) >= THRESHOLD ? Math.sign(dx) * 110 : 0;
      gsap.to(card, { x: settle, duration: 0.32, ease: "power3.out" });
    };

    card.addEventListener("pointerdown", onStart);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      card.removeEventListener("pointerdown", onStart);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, []);

  const reset = () => {
    if (cardRef.current) gsap.to(cardRef.current, { x: 0, duration: 0.3, ease: "power3.out" });
  };

  const togglePin = async () => {
    const { error } = await supabase
      .from("conversation_members")
      .update({ is_pinned: !conversation.is_pinned })
      .eq("conversation_id", conversation.id)
      .eq("user_id", currentUserId);
    reset();
    if (error) toast.error(error.message);
    else {
      toast.success(conversation.is_pinned ? "Unpinned" : "Pinned to top");
      onChanged();
    }
  };

  const toggleMute = async () => {
    const { error } = await supabase
      .from("conversation_members")
      .update({ is_muted: !conversation.is_muted })
      .eq("conversation_id", conversation.id)
      .eq("user_id", currentUserId);
    reset();
    if (error) toast.error(error.message);
    else {
      toast.success(conversation.is_muted ? "Unmuted" : "Muted");
      onChanged();
    }
  };

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-xl">
      {/* Right action (revealed when swiping left) */}
      <div className="pointer-events-auto absolute inset-y-0 right-0 flex w-28 items-center justify-end pr-2">
        <button
          type="button"
          onClick={toggleMute}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-elegant"
          aria-label={conversation.is_muted ? "Unmute" : "Mute"}
        >
          {conversation.is_muted ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </button>
      </div>
      {/* Left action (revealed when swiping right) */}
      <div className="pointer-events-auto absolute inset-y-0 left-0 flex w-28 items-center justify-start pl-2">
        <button
          type="button"
          onClick={togglePin}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-success-foreground shadow-elegant"
          aria-label={conversation.is_pinned ? "Unpin" : "Pin"}
        >
          {conversation.is_pinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
        </button>
      </div>
      <div ref={cardRef} className="relative bg-sidebar will-change-transform">
        <ConversationItem
          conversation={conversation}
          active={active}
          currentUserId={currentUserId}
          onClick={() => {
            // If swiped open, first reset
            if (cardRef.current && Math.abs(gsap.getProperty(cardRef.current, "x") as number) > 4) {
              reset();
              return;
            }
            onClick();
          }}
        />
      </div>
    </div>
  );
}
