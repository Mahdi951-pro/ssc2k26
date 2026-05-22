// Service worker: handles incoming web-push and notification clicks.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "SSC 2k26", body: event.data ? event.data.text() : "New message" };
  }
  const title = data.title || "SSC 2k26";
  const options = {
    body: data.body || "New message",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "ssc2k26-msg",
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: data.url || "/chat", conversationId: data.conversationId || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/chat";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        try { existing.navigate(target); } catch { /* ignore */ }
        return;
      }
      return self.clients.openWindow(target);
    })
  );
});
