// Kyuwing service worker. It makes the app installable and lets the game day pages open with
// weak or no signal: once a board, Fees or Sign-ups page has loaded, a copy of it is kept on the
// device and shown when the network is slow or gone. The game day itself (players, games,
// payments) lives in the page's own on-device store (lib/offline), which catches up with the
// server in the background, so a slightly old page copy is fine.

const VERSION = "kyuwing-v2";
/** The app's build files. Their names change with every deploy, so they never go stale. */
const STATIC_CACHE = "kyuwing-static";
/** Sounds and icons. */
const ASSET_CACHE = "kyuwing-assets-v1";
/** Signed-in pages, cleared on the sign-in page (see clearOfflineCopies in lib/offline/idb.ts). */
const PAGE_CACHE = "kyuwing-pages";
const KEEP = [VERSION, STATIC_CACHE, ASSET_CACHE, PAGE_CACHE];
/** How long to wait for the network before showing the copy on the device. */
const PAGE_TIMEOUT_MS = 3500;

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
  <p>This page hasn't been opened on this device yet, so there's no copy to show. A game day's board, Fees and Sign-ups work offline once they've been opened with signal.</p>
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
      await Promise.all(keys.filter((key) => !KEEP.includes(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

function offlinePage() {
  return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** Game day pages that work offline: the board, Fees and Sign-ups. */
function isOfflinePage(url) {
  return /^\/app\/gamedays\/[^/]+(\/(fees|signups))?\/?$/.test(url.pathname);
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    // Old deploys' files pile up; keep the newest few hundred.
    const keys = await cache.keys();
    if (keys.length > 600)
      await Promise.all(keys.slice(0, keys.length - 500).map((old) => cache.delete(old)));
  }
  return response;
}

/** The network when it answers quickly; otherwise the copy on the device, while the network keeps going. */
async function pageNetworkFirst(event) {
  const { request } = event;
  const cache = await caches.open(PAGE_CACHE);
  // One copy per page, whatever the query string (e.g. ?slot=1).
  const key = new URL(request.url);
  key.search = "";
  const network = fetch(request).then(async (response) => {
    if (response.ok && response.type === "basic" && !response.redirected) {
      await cache.put(key.href, response.clone());
    }
    return response;
  });
  event.waitUntil(network.catch(() => undefined));

  const cached = await cache.match(key.href);
  if (!cached) return network.catch(offlinePage);

  let timer;
  const slow = new Promise((resolve) => {
    timer = setTimeout(() => resolve(cached), PAGE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([network, slow]);
  } catch {
    return cached;
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (
    url.pathname.startsWith("/sounds/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }
  if (request.mode !== "navigate") return;
  if (isOfflinePage(url)) {
    event.respondWith(pageNetworkFirst(event));
    return;
  }
  event.respondWith(fetch(request).catch(offlinePage));
});
