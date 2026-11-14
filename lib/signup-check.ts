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
  /** Set when the two lists' headers name different dates or venues. */
  headerMismatch: string | null;
};

/** The two Messenger lists: members and alumni, and applicants. Either may be empty. */
export type SignupTexts = { members: string; applicants: string };

export function signupTexts(input: SignupTexts | string | null | undefined): SignupTexts {
  if (!input) return { members: "", applicants: "" };
  return typeof input === "string" ? { members: input, applicants: "" } : input;
}

/**
 * Reads the pasted Messenger lists and checks them against the database. Read-only. The
 * game day's details come from the members list's header, or the applicants list's when the
 * members box is empty; a name on both lists is flagged as listed twice.
 */
export async function checkSignup(input: SignupTexts | string, gameDayId?: string): Promise<SignupCheck> {
  const texts = signupTexts(input);
  const members = parseSignupText(texts.members, "members");
  const applicants = parseSignupText(texts.applicants, "applicants");
  const parsed = {
    header: members.header.title ? members.header : applicants.header,
    lines: [...members.lines, ...applicants.lines],
    ignored: [...members.ignored, ...applicants.ignored],
  };
  const mismatch: string[] = [];
  if (members.header.date && applicants.header.date && members.header.date !== applicants.header.date) {
    mismatch.push(`dates (${members.header.date} and ${applicants.header.date})`);
  }
  const shortA = members.header.venueShort?.toLowerCase();
  const shortB = applicants.header.venueShort?.toLowerCase();
  if (shortA && shortB && shortA !== shortB) {
    mismatch.push(`venues (${members.header.venueShort} and ${applicants.header.venueShort})`);
  }
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
    headerMismatch: mismatch.length
      ? `The two lists name different ${mismatch.join(" and ")}. The members list is used.`
      : null,
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
