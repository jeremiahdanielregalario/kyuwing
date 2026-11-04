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
