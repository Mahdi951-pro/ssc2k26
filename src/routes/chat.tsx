import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatPane } from "@/components/chat/ChatPane";
import { ProfileDialog } from "@/components/chat/ProfileDialog";
import { Conversation } from "@/hooks/useConversations";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/chat")({
  component: ChatRoute,
  head: () => ({
    meta: [
      { title: "Chat — SSC 2k26" },
      { name: "description", content: "Real-time messaging for SSC 2026 students." },
    ],
  }),
});

function ChatRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <ConversationList
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        onOpenProfile={() => setProfileOpen(true)}
        className={`w-full md:w-[340px] lg:w-[380px] ${selected ? "hidden md:flex" : "flex"}`}
      />
      <div className={`flex-1 ${selected ? "flex" : "hidden md:flex"}`}>
        <ChatPane conversation={selected} onBack={() => setSelected(null)} />
      </div>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
