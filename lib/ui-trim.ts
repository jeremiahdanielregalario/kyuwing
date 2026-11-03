/**
 * Registry of optional UI pieces the developer can hide from the app.
 *
 * Only elements explicitly tagged with a `data-trim-id` that appears here can
 * be hidden. Keeping the allow-list in code means trim mode can never remove a
 * critical control (check-in, auto-pair, save, delete confirmation, …).
 */

export const UI_HIDDEN_SETTING_KEY = "ui.hidden.v1";

export type TrimTarget = {
  id: string;
  group: string;
  label: string;
};

export const TRIM_TARGETS: TrimTarget[] = [
  // App shell
  { id: "shell.org-badge", group: "App shell", label: "Organisation badge" },
  { id: "shell.session-caption", group: "App shell", label: "“Queue master session” caption" },
  { id: "shell.footer-links", group: "App shell", label: "Public site / Venues links" },
  { id: "shell.credit", group: "App shell", label: "“App by Danyel Regalario” credit" },

  // Live board
  { id: "board.subtitle", group: "Live board", label: "Court time + live-sync line" },
  { id: "board.draft-banner", group: "Live board", label: "Draft notice" },
  { id: "board.completed-banner", group: "Live board", label: "Closed-game-day notice" },
  { id: "board.plan-label", group: "Live board", label: "“Court plan” label" },
  { id: "board.plan-clock", group: "Live board", label: "Manila clock" },
  { id: "board.rail.waiting-sub", group: "Live board", label: "Waiting stat sub-line" },
  { id: "board.rail.playing-sub", group: "Live board", label: "On-court stat sub-line" },
  { id: "board.rail.open-sub", group: "Live board", label: "Open-courts stat sub-line" },
  { id: "board.rail.games-sub", group: "Live board", label: "Games-today stat sub-line" },
  { id: "board.rail.wait-sub", group: "Live board", label: "Longest-wait stat sub-line" },
  { id: "board.courts-block", group: "Live board", label: "“Block 10:00–12:00” label" },
  { id: "board.live-count", group: "Live board", label: "Live court count" },
  { id: "board.drag-hint", group: "Live board", label: "Drag-and-drop hint" },
  { id: "board.recent", group: "Live board", label: "Recently finished panel" },
  { id: "board.queue-footer", group: "Live board", label: "Queue footer (longest wait / sign-ups)" },

  // Game days
  { id: "gamedays.description", group: "Game days", label: "Page description" },
  { id: "gamedays.info", group: "Game days", label: "Venue & type summary panel" },

  // Players
  { id: "players.description", group: "Players", label: "Page description" },
  { id: "players.stats", group: "Players", label: "Summary stat cards" },
  { id: "players.bracket-note", group: "Players", label: "Bracket-spread explainer" },
  { id: "players.level-legend", group: "Players", label: "Level legend footer" },

  // Venues & fees
  { id: "venues.description", group: "Venues & fees", label: "Page description" },
  { id: "venues.rates-warning", group: "Venues & fees", label: "Placeholder-rates warning" },
  { id: "venues.defaults-note", group: "Venues & fees", label: "“Defaults used…” note" },
  { id: "venues.fee-note", group: "Venues & fees", label: "Fee-table explainer" },

  // Guide
  { id: "guide.description", group: "Guide", label: "Page description" },
  { id: "guide.badges", group: "Guide", label: "Feature badges" },
  { id: "guide.loop", group: "Guide", label: "The game-day loop section" },
  { id: "guide.engine", group: "Guide", label: "How the engine thinks section" },
  { id: "guide.requests", group: "Guide", label: "Requests & priority section" },
  { id: "guide.checklists", group: "Guide", label: "Three checklists section" },
  { id: "guide.faq", group: "Guide", label: "Quick answers section" },
  { id: "guide.footer", group: "Guide", label: "Playbook footer note" },

  // Sign-ups
  { id: "signups.description", group: "Sign-ups", label: "Page description" },
  { id: "signups.tip", group: "Sign-ups", label: "Queue-master tip" },

  // Fees
  { id: "fees.description", group: "Fees", label: "Page description" },
  { id: "fees.formula", group: "Fees", label: "Fee formula sub-line" },
  { id: "fees.footer-note", group: "Fees", label: "Rate-change footer note" },

  // Reports
  { id: "reports.description", group: "Reports", label: "Page description" },
  { id: "reports.stats", group: "Reports", label: "Summary stat cards" },

  // Settings
  { id: "settings.description", group: "Settings", label: "Page description" },
  { id: "settings.details-note", group: "Settings", label: "“Safe to change…” note" },
  { id: "settings.courts-note", group: "Settings", label: "Court-block explainer" },
  { id: "settings.court-names-note", group: "Settings", label: "“Court names (optional)” label" },
  { id: "settings.status-sub", group: "Settings", label: "Session-status sub-line" },
  { id: "settings.danger-note", group: "Settings", label: "Delete-game-day warning" },
];

const TARGET_BY_ID = new Map(TRIM_TARGETS.map((target) => [target.id, target]));

export function isTrimId(value: unknown): value is string {
  return typeof value === "string" && TARGET_BY_ID.has(value);
}

/** Drop unknown/duplicate ids so stale code can never hide arbitrary selectors. */
export function sanitizeHidden(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(isTrimId)));
}

export function trimTarget(id: string): TrimTarget | undefined {
  return TARGET_BY_ID.get(id);
}

export function trimLabel(id: string): string {
  return TARGET_BY_ID.get(id)?.label ?? id;
}
