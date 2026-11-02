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
    }));
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
