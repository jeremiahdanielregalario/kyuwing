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
const NAME_LINE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ.'\- ]{0,31}$/;

export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseNameList(input: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const rawLine of input.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;

    line = line.replace(LIST_PREFIX, "").replace(/\s+/g, " ").trim();
    if (!line || NOISE_LINE.test(line)) continue;
    if (!NAME_LINE.test(line)) continue;
    // Guard against event headers that happen to be short and unpunctuated.
    if (line.split(" ").length > 4) continue;

    const key = nameKey(line);
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
export function parseAttendanceBlock(input: string): { played: string[]; waitlist: string[] } {
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
    played: parseNameList(playedLines.join("\n")),
    waitlist: parseNameList(waitlistLines.join("\n")),
  };
}
