import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, CheckCircle2, RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";

type PermissionState = NotificationPermission | "unsupported";

async function getWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/notification-sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export function NotificationPrompt() {
  const [permission, setPermission] = useState<PermissionState>("default");

  const refresh = () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  };

  useEffect(() => {
    refresh();
    getWorker();
  }, []);

  const enable = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      toast.success("Notifications enabled", { description: "You will see new message alerts." });
      const worker = await getWorker();
      await worker?.showNotification("SSC 2k26 notifications are ready", {
        body: "New messages will alert you here.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "ssc2k26-test",
      } as NotificationOptions & { badge?: string });
    }
  };

  if (permission === "granted" || permission === "unsupported") return null;

  if (permission === "denied") {
    return (
      <Alert className="mx-3 my-2 border-destructive/40 bg-destructive/10">
        <BellOff className="h-4 w-4" />
        <AlertTitle>Notifications are blocked</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            Turn on notifications in Chrome site settings for this app, then tap Recheck.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={refresh} className="rounded-full">
              <RefreshCw className="h-3.5 w-3.5" /> Recheck
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.message("Chrome settings", { description: "Open Chrome → Site settings → Notifications → allow this site." })} className="rounded-full">
              <Settings className="h-3.5 w-3.5" /> How to allow
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mx-3 my-2 border-primary/30 bg-primary/10">
      <Bell className="h-4 w-4" />
      <AlertTitle>Enable message notifications</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>Allow alerts so new messages appear immediately, even when the chat is not open.</p>
        <Button size="sm" onClick={enable} className="rounded-full bg-gradient-brand text-primary-foreground shadow-elegant">
          <CheckCircle2 className="h-3.5 w-3.5" /> Enable notifications
        </Button>
      </AlertDescription>
    </Alert>
  );
}