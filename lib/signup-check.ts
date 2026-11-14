import { prisma } from "./db";
import {
  blockingLines,
  parseSignupText,
  resolveSignup,
  type ResolvedLine,
  type SignupHeader,
} from "./signup-text";

export type SignupCheck = {
  header: SignupHeader & { venueId: string | null; venueName: string | null };
  /** Every numbered line, checked against the official nicknames. */
  lines: ResolvedLine[];
  /** Text that was neither header nor list, so the queue master can see what was skipped. */
  ignored: string[];
  /** Lines (not waitlisted) that still are not an official nickname. */
  blocking: number;
  /** Confirmed players, every one an official nickname, and at least one. */
  ready: boolean;
  /** Official nicknames already on the game day, when checking against one. */
  alreadyOnList: string[];
  /** Nicknames that are official but archived, shown as a heads-up. */
  inactive: string[];
};

/** Reads a pasted Messenger list and checks it against the database. Read-only. */
export async function checkSignup(text: string, gameDayId?: string): Promise<SignupCheck> {
  const parsed = parseSignupText(text);
  const [players, venues, existing] = await Promise.all([
    prisma.player.findMany({
      select: { id: true, nickname: true, fullName: true, aliases: true, active: true },
    }),
    prisma.venue.findMany({ select: { id: true, name: true, shortName: true } }),
    gameDayId
      ? prisma.sessionPlayer.findMany({
          where: { gameDayId },
          select: { player: { select: { nickname: true } } },
        })
      : Promise.resolve([]),
  ]);

  const lines = resolveSignup(parsed.lines, players);
  const venue = parsed.header.venueShort
    ? venues.find((row) => row.shortName.toLowerCase() === parsed.header.venueShort!.toLowerCase())
    : undefined;
  const blocking = blockingLines(lines).length;
  const confirmed = lines.filter((line) => !line.waitlist);
  const onList = new Set(existing.map((row) => row.player.nickname));
  const inactive = new Set(players.filter((player) => !player.active).map((player) => player.nickname));

  return {
    header: { ...parsed.header, venueId: venue?.id ?? null, venueName: venue?.name ?? null },
    lines,
    ignored: parsed.ignored,
    blocking,
    ready: confirmed.length > 0 && blocking === 0,
    alreadyOnList: confirmed
      .filter((line) => line.nickname && onList.has(line.nickname))
      .map((line) => line.nickname!),
    inactive: confirmed
      .filter((line) => line.nickname && inactive.has(line.nickname))
      .map((line) => line.nickname!),
  };
}

/** Plain-language reason a list is not ready, for an error message. */
export function notReadyReason(check: SignupCheck): string {
  if (check.lines.filter((line) => !line.waitlist).length === 0) {
    return "No numbered player lines were found in the pasted list.";
  }
  const bad = check.lines.filter((line) => !line.waitlist && line.status !== "ok");
  const shown = bad
    .slice(0, 4)
    .map((line) =>
      line.status === "duplicate"
        ? `${line.name} (listed twice)`
        : line.nickname
          ? `${line.name} (use "${line.nickname}")`
          : `${line.name} (not an official nickname)`,
    )
    .join(", ");
  return `Every name must be an official nickname. Fix: ${shown}${bad.length > 4 ? `, and ${bad.length - 4} more` : ""}.`;
}
