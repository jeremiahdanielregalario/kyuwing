/**
 * Parsing helpers for attendance lists pasted from a group chat.
 *
 * People paste numbered lists like:
 *
 *   1. Jgops
 *   2. Dylan
 *   12. Dane
 *
 * The importer accepts one list of players who played and one waitlist. These
 * helpers strip numbering, bullets, blanks, and repeated names, and give us a
 * stable key for matching against the player database. Pasted headers (event
 * titles, dates, time ranges) are ignored.
 */

/** Strips "1.", "12)", "- ", "• ", "* " and "· " prefixes. */
const LIST_PREFIX = /^\s*(?:\d{1,3}\s*[.)\-:]?|[-•*·])\s*/;

/** Section headers and other non-name lines. */
const NOISE_LINE =
  /^(?:wait\s*-?\s*list|waiting\s+list|reserved|bench|official\b|game\s*day\b|tournament\b|\d{1,2}\s*(?:am|pm)\b|[\s()[\]{}.,;:_\-–—/\\|]*)$/i;

/**
 * Nicknames are short: letters, spaces, dots, apostrophes and hyphens.
 * Anything else (dates, times, event titles with parentheses) is a header.
 */
const NAME_LINE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ.'\- ]{0,47}$/;

export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Keys a stored full name ("REGALARIO, Jeremiah Daniel") can be matched by:
 * as stored, and in the "Jeremiah Daniel Regalario" order chat mentions use.
 */
export function fullNameKeys(fullName: string): string[] {
  const stored = nameKey(fullName);
  const [last, first] = fullName.split(",").map((part) => part.trim());
  if (!last || !first) return [stored];
  return [stored, nameKey(`${first} ${last}`)];
}

/**
 * `isKnown` lets a line that is exactly a nickname in the database through even when it looks
 * like a header (digits, "Bench"), so nothing is dropped when an edited list is saved again.
 */
export function parseNameList(input: string, isKnown?: (key: string) => boolean): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  // Tabs separate cells when a list is copied from a spreadsheet or a grid.
  for (const rawLine of input.split(/\r?\n|\t/)) {
    let line = rawLine.trim();
    if (!line) continue;

    // A leading "@" is a Messenger mention of the player.
    line = line.replace(LIST_PREFIX, "").replace(/^@/, "").replace(/\s+/g, " ").trim();
    if (!line) continue;
    const key = nameKey(line);
    if (!isKnown?.(key)) {
      if (NOISE_LINE.test(line)) continue;
      if (!NAME_LINE.test(line)) continue;
      // Guard against event headers that happen to be short and unpunctuated.
      if (line.split(" ").length > 4) continue;
    }

    if (seen.has(key)) continue;

    seen.add(key);
    names.push(line);
  }

  return names;
}

/**
 * Parses a single pasted block that may contain a "Waitlist:" section.
 * Returns the players split into played and waitlisted.
 */
export function parseAttendanceBlock(
  input: string,
  isKnown?: (key: string) => boolean,
): { played: string[]; waitlist: string[] } {
  const lines = input.split(/\r?\n/);
  const playedLines: string[] = [];
  const waitlistLines: string[] = [];
  let inWaitlist = false;

  for (const line of lines) {
    if (/^\s*(?:wait\s*-?\s*list|waiting\s+list|reserved)\s*:?\s*$/i.test(line)) {
      inWaitlist = true;
      continue;
    }
    if (inWaitlist) waitlistLines.push(line);
    else playedLines.push(line);
  }

  return {
    played: parseNameList(playedLines.join("\n"), isKnown),
    waitlist: parseNameList(waitlistLines.join("\n"), isKnown),
  };
}

export type AttendanceSyncEntry = { playerId: string; status: "PLAYED" | "WAITLIST" };

/**
 * What an ended game day does to its attendance list. Everyone who checked in played. A list
 * already logged for that date (e.g. pasted from the chat) keeps its other names, so the chat's
 * waitlist survives; a sign-up of this game day who never checked in (or whose check-in was
 * undone before it was ended again) is taken off the Played list. Pure, so it is unit-tested.
 */
export function syncGameDayAttendance(
  existing: AttendanceSyncEntry[],
  session: Array<{ playerId: string; checkedIn: boolean }>,
): { upsertPlayed: string[]; remove: string[] } {
  const played = session.filter((row) => row.checkedIn).map((row) => row.playerId);
  const noShows = new Set(session.filter((row) => !row.checkedIn).map((row) => row.playerId));
  const already = new Map(existing.map((entry) => [entry.playerId, entry.status]));
  return {
    upsertPlayed: played.filter((id) => already.get(id) !== "PLAYED"),
    remove: existing
      .filter((entry) => entry.status === "PLAYED" && noShows.has(entry.playerId))
      .map((entry) => entry.playerId),
  };
}
