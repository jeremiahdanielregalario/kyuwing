import { formatGameDate } from "@/lib/datetime";

/**
 * The group-chat message for a game day's live view link. Plain text so it pastes cleanly
 * into Messenger; the link sits on its own line so Messenger turns it into a preview.
 */
export function liveShareMessage(
  gameDay: { name: string; date: string; venue: string },
  url: string,
): string {
  return [
    `🏸 Live queue: ${gameDay.name}`,
    `${formatGameDate(gameDay.date, { weekday: true, year: false })} · ${gameDay.venue}`,
    "",
    "See the courts, who's next and your place in line (view only):",
    url,
    "",
    "Type your nickname on the page to check when you're up.",
  ].join("\n");
}

/**
 * The message for the finance member with the game day's view-only fees link. Sent privately,
 * not to the players' group chat: it lists every player's balance.
 */
export function feesShareMessage(
  gameDay: { name: string; date: string; venue: string },
  url: string,
): string {
  return [
    `💰 Fees: ${gameDay.name}`,
    `${formatGameDate(gameDay.date, { weekday: true, year: false })} · ${gameDay.venue}`,
    "",
    "What each player owes and has paid, updated as payments are recorded (view only):",
    url,
  ].join("\n");
}

/** A safe file name for the downloaded QR code, e.g. `kyuwing-live-monday-night-lights-2026-11-11.png`. */
export function liveQrFileName(gameDay: { name: string; date: string }, kind = "live"): string {
  const slug = gameDay.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const day = gameDay.date.slice(0, 10);
  return `kyuwing-${kind}-${slug ? `${slug}-` : ""}${day}.png`;
}
