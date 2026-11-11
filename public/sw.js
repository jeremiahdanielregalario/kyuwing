// Kyuwing service worker. It makes the app installable and shows a friendly page when a
// page can't load offline. It deliberately caches nothing else: the board is live data
// behind a sign-in, so every request goes to the network.

const VERSION = "kyuwing-v1";

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#000000">
<title>Offline · Kyuwing</title>
<style>
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #fbfaf5; color: #0a0a0a;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif; padding: 24px; box-sizing: border-box; }
  main { max-width: 340px; text-align: center; }
  .dot { width: 14px; height: 14px; border-radius: 999px; background: #ffd600; margin: 0 auto 18px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { color: #6b6b60; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
  button { font: inherit; font-weight: 600; font-size: 14px; border: 0; border-radius: 999px; padding: 12px 22px;
    background: #000; color: #fbfaf5; min-height: 44px; }
</style>
</head>
<body>
<main>
  <div class="dot"></div>
  <h1>You're offline</h1>
  <p>Kyuwing needs an internet connection to load the queue board. Check your Wi-Fi or data, then try again.</p>
  <button onclick="location.reload()">Try again</button>
</main>
</body>
</html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(
      () =>
        new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
