/**
 * When a check-in can be undone, i.e. put back to "expected". It is for a mistake
 * (the wrong person, tapped too early), so it only applies to someone who is
 * waiting and has not played or been lined up. Pure, so it is unit-tested.
 */
export type UndoCheckIn = { allow: true } | { allow: false; reason: string };

export function canUndoCheckIn(input: {
  nickname: string;
  status: "EXPECTED" | "WAITING" | "PLAYING" | "DONE";
  gamesPlayed: number;
  /** Where they are lined up (a court or waiting game name), if in a suggested game. */
  linedUpFor: string | null;
}): UndoCheckIn {
  const { nickname, status } = input;
  if (status === "EXPECTED") return { allow: false, reason: `${nickname} is not checked in.` };
  if (status === "PLAYING")
    return { allow: false, reason: `${nickname} is on court. Finish the game first.` };
  if (status === "DONE")
    return { allow: false, reason: `${nickname} is already marked done. Use Requeue instead.` };
  if (input.gamesPlayed > 0) {
    return {
      allow: false,
      reason: `${nickname} has already played ${input.gamesPlayed} ${input.gamesPlayed === 1 ? "game" : "games"}. Mark them done instead of undoing the check-in.`,
    };
  }
  if (input.linedUpFor) {
    return {
      allow: false,
      reason: `${nickname} is lined up for ${input.linedUpFor}. Cancel or edit that game first.`,
    };
  }
  return { allow: true };
}
