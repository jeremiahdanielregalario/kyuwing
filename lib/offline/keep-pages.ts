/**
 * Asks the service worker (public/sw.js) to save a game day's board, Fees and Sign-ups pages on
 * this device now, so each opens without signal even if it hasn't been visited yet today.
 */
export function keepGameDayPages(gameDayId: string) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const base = `/app/gamedays/${encodeURIComponent(gameDayId)}`;
  const paths = [base, `${base}/fees`, `${base}/signups`];
  navigator.serviceWorker.ready
    .then((registration) => registration.active?.postMessage({ type: "keep-pages", paths }))
    .catch(() => undefined);
}
