import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, CheckCircle2, RefreshCw, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { registerPushWorker, subscribeUserToPush, pushSupported } from "@/lib/pushNotifications";

type PermissionState = NotificationPermission | "unsupported";

async function getWorker() {
  return await registerPushWorker();
}

export function NotificationPrompt() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [hidden, setHidden] = useState(false);

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

  if (hidden || permission === "granted" || permission === "unsupported") return null;

  if (permission === "denied") {
    return (
      <div
        role="alert"
        className="mx-2 my-1.5 grid grid-cols-[auto_1fr_auto] items-start gap-x-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 sm:mx-3"
      >
        <BellOff className="mt-0.5 h-4 w-4" />
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold leading-tight">Notifications blocked</h3>
          <p className="text-xs leading-snug text-muted-foreground">
            Allow this site in Chrome notification settings, then recheck.
          </p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={refresh}
              className="h-8 rounded-full px-3 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Recheck
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast.message("Chrome settings", {
                  description: "Open Chrome → Site settings → Notifications → allow this site.",
                })
              }
              className="h-8 rounded-full px-3 text-xs"
            >
              <Settings className="h-3.5 w-3.5" /> Help
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="rounded-full p-1 text-muted-foreground hover:bg-background/60"
          aria-label="Hide notification warning"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="mx-2 my-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 sm:mx-3"
    >
      <Bell className="h-4 w-4" />
      <h3 className="mt-1 text-sm font-semibold">Enable message alerts</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="min-w-0 flex-1">Get new messages immediately.</span>
        <Button
          size="sm"
          onClick={enable}
          className="h-8 rounded-full bg-gradient-brand px-3 text-xs text-primary-foreground shadow-elegant"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Enable notifications
        </Button>
      </div>
    </div>
  );
}
