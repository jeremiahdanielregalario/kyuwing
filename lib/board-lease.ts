/**
 * Which device holds a game day's board. The holder is the device that changed it last. While
 * the holder is out of touch (no sync or poll for `LEASE_STALE_MS`), other devices can't change
 * the game day, so the only copy moving is the holder's offline one and nothing clashes when it
 * syncs. Another signed-in device can take the board over; that raises `epoch`, so the old
 * holder's changes made before the takeover are refused when they arrive.
 *
 * Pure (no database), so the rules are unit-tested and shared by the server and the tablet.
 */

/** The holder counts as offline after this long without reaching the server. */
export const LEASE_STALE_MS = 30_000;

export type Lease = {
  deviceId: string;
  /** When the holder last reached the server (ms). */
  seenAt: number;
  epoch: number;
  /** The queue master's name on the holding device. */
  name: string | null;
  /** E.g. "iPad · Safari". */
  device: string | null;
};

/** The device asking to change the board. `epoch` is the lease epoch it knew when the changes were made. */
export type Claimant = {
  deviceId: string;
  epoch?: number;
  name?: string | null;
  label?: string | null;
};

/** What a device is told about the lease. */
export type LeaseView = {
  holder: "you" | "other" | "none";
  epoch: number;
  /** How long ago the holder last reached the server (ms). */
  ageMs: number;
  name: string | null;
  label: string | null;
};

export type LeaseJudgement = { ok: true; next: Lease } | { ok: false; error: string };

export const TAKEN_OVER_MESSAGE =
  "Another device took over the board while this one was offline, so this change wasn't saved.";

export function isStale(lease: Pick<Lease, "seenAt">, now: number): boolean {
  return now - lease.seenAt > LEASE_STALE_MS;
}

/** "45 s", "3 min", "2 h 5 min". */
export function formatAgo(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** "Ana (iPad · Safari)", or whichever part is known. */
export function holderName(lease: {
  name: string | null;
  device?: string | null;
  label?: string | null;
}): string {
  const device = lease.device ?? lease.label ?? null;
  if (lease.name && device) return `${lease.name} (${device})`;
  return lease.name ?? device ?? "another device";
}

export function heldMessage(
  lease: { name: string | null; device?: string | null; label?: string | null },
  ageMs: number,
): string {
  return `The board is held by ${holderName(lease)}, offline for ${formatAgo(ageMs)}. Changes can be saved once it is back online, or after taking over the board.`;
}

function claim(who: Claimant, now: number, epoch: number): Lease {
  return {
    deviceId: who.deviceId,
    seenAt: now,
    epoch,
    name: who.name ?? null,
    device: who.label ?? null,
  };
}

/** May `who` change the board now, and who holds it afterwards? */
export function judgeChange(lease: Lease | null, who: Claimant, now: number): LeaseJudgement {
  if (!lease) return { ok: true, next: claim(who, now, 0) };
  if (who.epoch !== undefined && who.epoch < lease.epoch) return { ok: false, error: TAKEN_OVER_MESSAGE };
  if (lease.deviceId === who.deviceId) return { ok: true, next: claim(who, now, lease.epoch) };
  if (!isStale(lease, now)) return { ok: true, next: claim(who, now, lease.epoch) };
  return { ok: false, error: heldMessage(lease, now - lease.seenAt) };
}

/**
 * Taking the board over. Only needed (and only raises the epoch) when the holder is out of
 * touch; with no holder, or the holder online, the caller can simply change the board.
 */
export function judgeTakeover(lease: Lease | null, who: Claimant, now: number): Lease {
  if (!lease) return claim(who, now, 0);
  if (lease.deviceId === who.deviceId || !isStale(lease, now)) return lease;
  return claim(who, now, lease.epoch + 1);
}

export function leaseView(lease: Lease | null, deviceId: string | null, now: number): LeaseView {
  if (!lease) return { holder: "none", epoch: 0, ageMs: 0, name: null, label: null };
  return {
    holder: deviceId && lease.deviceId === deviceId ? "you" : "other",
    epoch: lease.epoch,
    ageMs: Math.max(0, now - lease.seenAt),
    name: lease.name,
    label: lease.device,
  };
}

/** For the `X-Board-Lease` header (names can be non-ASCII). */
export function encodeLeaseHeader(view: LeaseView): string {
  return encodeURIComponent(JSON.stringify(view));
}

export function decodeLeaseHeader(value: string | null): LeaseView | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as LeaseView;
    if (parsed && (parsed.holder === "you" || parsed.holder === "other" || parsed.holder === "none"))
      return parsed;
  } catch {
    // Unreadable: treat as unknown.
  }
  return null;
}

/** A lease as the device keeps it: the view plus when it arrived. */
export type DeviceLease = LeaseView & { receivedAt: number };

/**
 * Why this device can't change the board right now, or null when it can. A device that doesn't
 * hold the board is locked while it is offline itself (its changes couldn't sync), and while the
 * holder is out of touch.
 */
export function lockReason(lease: DeviceLease | null, online: boolean, now: number): string | null {
  if (!lease || lease.holder !== "other") return null;
  const age = lease.ageMs + Math.max(0, now - lease.receivedAt);
  if (!online)
    return `You're offline, and the board is held by ${holderName(lease)}. Changes are paused here until this device is back online.`;
  if (age > LEASE_STALE_MS) return heldMessage(lease, age);
  return null;
}
