import { QUEUED_COURT } from "@/lib/datetime";

/**
 * Which drop targets a drag may land on, on the queue board.
 *
 * Without this the nearest target wins whatever it is, so dragging a court card
 * could highlight, and look like it fits in, a player's box. A court goes onto
 * other courts or waiting games, never itself; a player from the queue goes onto
 * player boxes, empty court slots and empty courts; a player already in a game
 * only onto other player boxes. Pure, so it is unit-tested.
 */
export type DragData = { kind: string; matchId?: string };
export type DropData = { kind: string; matchId?: string };

export function canDropOn(active: DragData | undefined, target: DropData | undefined): boolean {
  if (!target) return false;
  switch (active?.kind) {
    case "match":
      return target.kind === "court" && target.matchId !== active.matchId;
    case "match-player":
      return target.kind === "slot";
    case "queue-player":
      return (
        target.kind === "slot" || target.kind === "draft-slot" || (target.kind === "court" && !target.matchId)
      );
    default:
      return true;
  }
}

/** A picked item for tap-to-move: the same shape as a drag payload. */
export type PickData = DragData & { courtNumber?: number; playerId?: string; status?: string };
export type TapTargetData = DropData & { courtNumber?: number; playerId?: string };

/** True when two picks are the same thing, so tapping it again puts it down. */
export function samePick(a: PickData | null, b: PickData): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === "match") return a.matchId === b.matchId;
  return a.playerId === b.playerId && a.matchId === b.matchId;
}

/**
 * Tap-to-move (the phone-friendly alternative to dragging): may the picked item land on this
 * target? Stricter than `canDropOn`, because tap targets are highlighted, so it leaves out moves
 * the board would only refuse: a player onto their own box, someone still on court onto a real
 * court, and a game on a real court onto a waiting game. `courtOf` gives a game's court.
 */
export function canTapOn(
  picked: PickData | null,
  target: TapTargetData,
  courtOf: (matchId: string) => number | undefined,
): boolean {
  if (!picked || !canDropOn(picked, target)) return false;
  if (target.kind === "slot" && target.playerId === picked.playerId) return false;
  const targetCourt = target.kind === "slot" ? courtOf(target.matchId ?? "") : target.courtNumber;
  if (picked.kind === "match") {
    const pickedWaiting = picked.courtNumber === QUEUED_COURT;
    // Waiting games trade places with other waiting games; nothing lands on an empty waiting court.
    if (targetCourt === QUEUED_COURT) return pickedWaiting && !!target.matchId;
    // A waiting game only takes a free court; games on courts can also swap courts.
    return !pickedWaiting || !target.matchId;
  }
  if (picked.kind === "queue-player" && picked.status === "PLAYING") return targetCourt === QUEUED_COURT;
  return true;
}
