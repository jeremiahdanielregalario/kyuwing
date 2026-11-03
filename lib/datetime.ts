export const MANILA_TIMEZONE = "Asia/Manila";

export function manilaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
    weekday: get("weekday"),
  };
}

/** YYYY-MM-DD in Manila. */
export function manilaDateKey(date = new Date()): string {
  const { year, month, day } = manilaParts(date);
  return `${year}-${month}-${day}`;
}

/** HH:mm in Manila. */
export function manilaTime(date = new Date()): string {
  const { hour, minute } = manilaParts(date);
  return `${hour}:${minute}`;
}

export function manilaWeekday(date = new Date()): number {
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[manilaParts(date).weekday] ?? 0;
}

/** Date-only value for Prisma @db.Date. Always UTC midnight of the Manila calendar date. */
export function dateOnly(date = new Date()): Date {
  return new Date(`${manilaDateKey(date)}T00:00:00.000Z`);
}

export function dateOnlyFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function formatGameDate(
  date: Date | string,
  opts: { weekday?: boolean; year?: boolean } = {},
): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    weekday: opts.weekday ? "long" : undefined,
    month: "short",
    day: "numeric",
    year: opts.year === false ? undefined : "numeric",
  }).format(value);
}

export function formatGameDateShort(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(value);
}

export function weekdayLabel(dayOfWeek: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek] ?? "";
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToLabel(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${start}–${end}`;
}

export function elapsedMinutes(
  from: Date | string | null | undefined,
  to: Date | string = new Date(),
): number {
  if (!from) return 0;
  const start = typeof from === "string" ? new Date(from) : from;
  const end = typeof to === "string" ? new Date(to) : to;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000));
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatClock(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export type CourtSlot = {
  id: string;
  label: string;
  start: string;
  end: string;
  courts: number;
  /** Optional display names for each court position, e.g. "Court 5", "Reserved A". */
  courtLabels?: string[];
};

export function parseCourtPlan(value: unknown): CourtSlot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row, index) => ({
      id: typeof row.id === "string" ? row.id : `slot-${index + 1}`,
      label: typeof row.label === "string" ? row.label : `Slot ${index + 1}`,
      start: typeof row.start === "string" ? row.start : "10:00",
      end: typeof row.end === "string" ? row.end : "12:00",
      courts: Math.min(20, Math.max(1, Number(row.courts) || 1)),
      ...(() => {
        if (!Array.isArray(row.courtLabels)) return {};
        const labels = row.courtLabels
          .filter((entry): entry is string => typeof entry === "string")
          .slice(0, 20)
          .map((entry) => entry.trim().slice(0, 24));
        return labels.some((entry) => entry.length > 0) ? { courtLabels: labels } : {};
      })(),
    }));
}

/** Display name for a court position, e.g. "Court 5" or the master's own label. */
/**
 * Court number of a game waiting in the "Next up" line. Queued games are
 * suggested matches without a court; they take the next court that frees up,
 * oldest first.
 */
export const QUEUED_COURT = 0;

/** Courts 1..total that no active match is using, lowest first. */
export function openCourts(total: number, busy: Iterable<number>): number[] {
  const taken = new Set(busy);
  return Array.from({ length: total }, (_, index) => index + 1).filter((court) => !taken.has(court));
}

/**
 * A block without one court (1-based position). Later courts shift down a
 * position but keep their names, so "5, 6, 7, 8" without 6 reads "5, 7, 8",
 * and unnamed courts 1-4 without 2 read "1, 3, 4" rather than renumbering.
 */
export function withoutCourt(slot: CourtSlot, court: number): CourtSlot {
  const labels = Array.from(
    { length: slot.courts },
    (_, index) => slot.courtLabels?.[index]?.trim() || String(index + 1),
  );
  labels.splice(court - 1, 1);
  return { ...slot, courts: slot.courts - 1, courtLabels: labels };
}

/** A doubles game runs about this long; starting one closer to closing time may not finish. */
export const FREE_GAME_WINDOW_MINUTES = 15;

/**
 * Minutes until the reservation ends (the latest block end), or null when the
 * game day is not today in Manila. Negative once the reservation has ended.
 */
export function minutesLeftInReservation(
  plan: CourtSlot[],
  gameDate: Date | string,
  now = new Date(),
): number | null {
  if (plan.length === 0) return null;
  const dateKey = (typeof gameDate === "string" ? gameDate : gameDate.toISOString()).slice(0, 10);
  if (dateKey !== manilaDateKey(now)) return null;
  const end = Math.max(...plan.map((slot) => timeToMinutes(slot.end)));
  return end - timeToMinutes(manilaTime(now));
}

/** True when a game started now should be offered as a free game. */
export function offersFreeGame(minutesLeft: number | null): boolean {
  return minutesLeft !== null && minutesLeft < FREE_GAME_WINDOW_MINUTES;
}

export function courtName(slot: CourtSlot | undefined, court: number): string {
  if (court === QUEUED_COURT) return "Next up";
  const label = slot?.courtLabels?.[court - 1]?.trim();
  if (!label) return `Court ${court}`;
  // A master who types just "5" gets "Court 5"; full names pass through as typed.
  return /^\d+$/.test(label) ? `Court ${label}` : label;
}

/** Index of the slot covering now, or the next upcoming slot, or the first slot. */
export function currentSlotIndex(plan: CourtSlot[], now = new Date()): number {
  if (plan.length === 0) return 0;
  const current = timeToMinutes(manilaTime(now));
  const covering = plan.findIndex(
    (slot) => current >= timeToMinutes(slot.start) && current < timeToMinutes(slot.end),
  );
  if (covering >= 0) return covering;
  const upcoming = plan.findIndex((slot) => current < timeToMinutes(slot.start));
  return upcoming >= 0 ? upcoming : 0;
}

export function weekdayFromKey(key: string): number {
  return new Date(`${key}T00:00:00.000Z`).getUTCDay();
}
