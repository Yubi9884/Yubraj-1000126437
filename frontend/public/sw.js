// Save app files here for offline use. Save each user's data separately in IndexedDB.
const CACHE_NAME = "studypass-shell-v1";
const PRECACHE = /* BUILD_PRECACHE */ ["/", "/index.html", "/icon.svg", "/manifest.webmanifest"];

// Save the main app files when the service worker is first installed.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

// Delete old saved app files when a new version takes over.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("studypass-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Try the internet first. If it fails, use saved app files.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Cache same-origin app files and leave API requests to the network.
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js"
  ) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          // The cache needs its own response stream while the original goes back to the page.
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)),
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Use the app shell for offline navigation, including reminder links containing a task ID.
        if (event.request.mode === "navigate") return caches.match("/index.html");
        return Response.error();
      }),
  );
});

// While developing, main.jsx tells us which loaded files to save for offline use.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_DEV_FILES") return;
  const urls = event.data.urls.filter((value) => {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin &&
      !url.pathname.startsWith("/api/") && url.pathname !== "/sw.js";
  });
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(urls.map((url) => cache.add(url))),
    ),
  );
});

// Show a reminder using the title and message sent by the server.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    // If the message cannot be read, use the reminder text below.
  }
  // An empty tag lets each test display as a separate notification.
  const tag = payload.tag === "studypass-test" ? "" : payload.tag || "studypass";
  event.waitUntil(
    self.registration.showNotification(payload.title || "StudyPass reminder", {
      body: payload.body || "You have an upcoming deadline.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag,
      data: { url: payload.url || "/" },
    }),
  );
});

// Click a reminder to open its task. Reuse an app tab if one is already open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = new URL(event.notification.data?.url || "/", self.location.origin);
  // Keep notification clicks on the app origin even if the payload contains another address.
  const url = requested.origin === self.location.origin ? requested.href : self.location.origin;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const client = clients.find((item) => item.url.startsWith(self.location.origin));
        if (client) {
          await client.navigate(url);
          return client.focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});
