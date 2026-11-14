/**
 * The sign-up list players keep in a Messenger chat, e.g.
 *
 *   Official MEGA Game Day (KBC)
 *   Nov 2, 2026; Monday
 *   10AM - 3PM
 *
 *   1. QM: Jgops
 *   2. FIN: Dylan
 *   3. @Shawn Elizarde
 *   4. Randolf
 *
 * The chat keeps two lists: members and alumni by official nickname, and
 * applicants as "Nickname Surname" ("Matt Dela Cruz"). Each is pasted in its own
 * box and parsed with its `list`; placeholder lines like "18-43. MEMALUMNS" and
 * empty numbered lines are skipped.
 *
 * `parseSignupText` reads the header and the numbered lines; `resolveSignup`
 * checks every name against the official nicknames in the player database.
 * Only exact official nicknames count (plus "Nickname Surname" on the applicants
 * list): a full name or a typo is reported with a suggestion, and the queue
 * master has to fix the line. Pure, so it is
 * unit-tested; the database lookup lives in `lib/signup-check.ts`.
 */
import { aliasIndex } from "./aliases";
import { fullNameKeys, nameKey } from "./attendance";

export type SignupType = "REGULAR" | "TIPID" | "MEGA";
export type SignupRole = "QM" | "FIN";
/** Which Messenger list a line came from. */
export type SignupList = "members" | "applicants";

export type SignupHeader = {
  /** First line of the message, e.g. "Official MEGA Game Day (KBC)". */
  title: string | null;
  type: SignupType;
  /** Venue short name from the parentheses in the title, e.g. "KBC". */
  venueShort: string | null;
  /** YYYY-MM-DD. */
  date: string | null;
  /** 24-hour HH:MM. */
  start: string | null;
  end: string | null;
};

export type SignupLine = {
  /** Index of the line in the pasted text, so a fix can rewrite just that line. */
  lineIndex: number;
  /** The number written in the list. */
  number: number;
  role: SignupRole | null;
  /** The name as written, with the number, role label and "@" removed. */
  name: string;
  /** True for a Messenger mention ("@Shawn Elizarde"). */
  mention: boolean;
  /** Listed under a "Waitlist" heading: not confirmed, so not added. */
  waitlist: boolean;
  /** The members-and-alumni list or the applicants list. */
  list: SignupList;
};

export type ParsedSignup = { header: SignupHeader; lines: SignupLine[]; ignored: string[] };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE_RE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i;
const TIME_RE = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
const NUMBERED = /^\s*(\d{1,3})\s*[.)]\s*(.*)$/;
/** "18-43. MEMALUMNS", "38-54. APPS": places kept for the other list, not players. */
const RANGE = /^\s*\d{1,3}\s*[-–—]\s*\d{1,3}\s*(?:[.)]|\s+(?![ap]\.?m\b)[a-z])/i;
const WAITLIST = /^\s*(?:wait\s*-?\s*list|waiting\s+list|reserved?|bench)\b/i;
const ROLE = /^\s*(qm|queue\s*master|fin|finance(?:\s*member)?)\s*[:\-–]\s*/i;

function to24(hour: number, meridiem: string): number {
  const h = hour % 12;
  return meridiem.toLowerCase() === "pm" ? h + 12 : h;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseTime(line: string): { start: string; end: string } | null {
  const match = TIME_RE.exec(line);
  if (!match) return null;
  const [, h1, m1, mer1, h2, m2, mer2] = match;
  const end = to24(Number(h2), mer2) * 60 + Number(m2 ?? 0);
  let start = to24(Number(h1), mer1 ?? mer2) * 60 + Number(m1 ?? 0);
  // "10-3PM" reads as 10 AM to 3 PM, not 10 PM.
  if (!mer1 && start >= end) start = to24(Number(h1), "am") * 60 + Number(m1 ?? 0);
  if (start >= end) return null;
  const clock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  return { start: clock(start), end: clock(end) };
}

function parseDate(line: string): string | null {
  const match = DATE_RE.exec(line);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].toLowerCase()) + 1;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  // Reject dates that roll over, like "Feb 31".
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseSignupText(input: string, list: SignupList = "members"): ParsedSignup {
  const rows = input.split(/\r?\n/);
  const header: SignupHeader = {
    title: null,
    type: "REGULAR",
    venueShort: null,
    date: null,
    start: null,
    end: null,
  };
  const lines: SignupLine[] = [];
  const ignored: string[] = [];
  let inList = false;
  let inWaitlist = false;

  rows.forEach((raw, lineIndex) => {
    const row = raw.trim();
    if (!row) return;
    // Only inside the list, so a header time like "10-3PM" is never taken for one.
    if (inList && RANGE.test(row)) return;

    const numbered = NUMBERED.exec(row);
    if (numbered) {
      inList = true;
      let text = numbered[2].replace(/\s+/g, " ").trim();
      let role: SignupRole | null = null;
      const roleMatch = ROLE.exec(text);
      if (roleMatch) {
        role = /^(qm|queue)/i.test(roleMatch[1]) ? "QM" : "FIN";
        text = text.slice(roleMatch[0].length).trim();
      }
      const mention = text.startsWith("@");
      text = text.replace(/^@+\s*/, "").trim();
      // An open place ("2." with no name) under the waitlist.
      if (!text) return;
      lines.push({
        lineIndex,
        number: Number(numbered[1]),
        role,
        name: text,
        mention,
        waitlist: inWaitlist,
        list,
      });
      return;
    }

    if (WAITLIST.test(row)) {
      inList = true;
      inWaitlist = true;
      return;
    }

    if (inList) {
      ignored.push(row);
      return;
    }

    // Header lines, before the list starts.
    if (header.title === null) {
      header.title = row;
      if (/\bmega\b/i.test(row)) header.type = "MEGA";
      else if (/\btipid\b/i.test(row)) header.type = "TIPID";
      const venue = [...row.matchAll(/\(([^)]+)\)/g)].pop();
      if (venue) header.venueShort = venue[1].trim();
      return;
    }
    if (header.date === null) {
      const date = parseDate(row);
      if (date) {
        header.date = date;
        return;
      }
    }
    if (header.start === null) {
      const time = parseTime(row);
      if (time) {
        header.start = time.start;
        header.end = time.end;
        return;
      }
    }
    ignored.push(row);
  });

  return { header, lines, ignored };
}

export type KnownPlayer = { nickname: string; fullName: string | null; aliases?: string[] | null };

export type ResolvedLine = SignupLine & {
  /**
   * ok: an official nickname. suggest: not an official nickname, but it matches a
   * player's full name. unknown: no match. duplicate: the same player twice.
   */
  status: "ok" | "suggest" | "unknown" | "duplicate";
  /** The official nickname, for ok, suggest and duplicate. */
  nickname: string | null;
  /** Official nicknames it might have been meant to be. */
  suggestions: string[];
  /** Matched through one of the player's other names (e.g. "LA" for "Ian LA"), not the nickname. */
  viaAlias?: boolean;
  /** Matched as "Nickname Surname" ("Matt Dela Cruz"), the applicants list's format. */
  viaSurname?: boolean;
};

/**
 * Keys for "Nickname Surname". Stored full names read "DELA CRUZ, Matthew", so the surname is
 * the part before the comma; without a comma, the last one or two words are tried.
 */
export function nicknameSurnameKeys(nickname: string, fullName: string | null): string[] {
  if (!fullName?.trim()) return [];
  const [before, after] = fullName.split(",").map((part) => part.trim());
  const surnames = after
    ? [before]
    : (() => {
        const words = before.split(/\s+/);
        return [words.slice(-1), words.slice(-2)]
          .filter((part) => part.length < words.length)
          .map((part) => part.join(" "));
      })();
  return surnames.filter(Boolean).map((surname) => nameKey(`${nickname} ${surname}`));
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** Checks each pasted name against the official nicknames. */
export function resolveSignup(lines: SignupLine[], players: KnownPlayer[]): ResolvedLine[] {
  const byNickname = new Map(players.map((player) => [nameKey(player.nickname), player.nickname]));
  const byAlias = aliasIndex(players.map((player) => ({ aliases: player.aliases, value: player.nickname })));
  const byFullName = new Map<string, string>();
  for (const player of players) {
    if (!player.fullName) continue;
    for (const key of fullNameKeys(player.fullName)) byFullName.set(key, player.nickname);
  }
  // "Nickname Surname"; a key two players share matches nobody.
  const bySurname = new Map<string, string | null>();
  for (const player of players) {
    for (const key of nicknameSurnameKeys(player.nickname, player.fullName)) {
      const current = bySurname.get(key);
      bySurname.set(key, current === undefined || current === player.nickname ? player.nickname : null);
    }
  }

  const seen = new Set<string>();
  return lines.map((line) => {
    const key = nameKey(line.name);
    const viaAlias = !byNickname.has(key) && byAlias.has(key);
    const fromSurname = bySurname.get(key) ?? undefined;
    // Applicants are listed as "Nickname Surname", so that counts as official on their list.
    const viaSurname =
      !byNickname.has(key) && !viaAlias && line.list === "applicants" && Boolean(fromSurname);
    const official = byNickname.get(key) ?? byAlias.get(key) ?? (viaSurname ? fromSurname : undefined);
    if (official) {
      if (!line.waitlist && seen.has(official)) {
        return { ...line, status: "duplicate", nickname: official, suggestions: [], viaAlias, viaSurname };
      }
      if (!line.waitlist) seen.add(official);
      return { ...line, status: "ok", nickname: official, suggestions: [], viaAlias, viaSurname };
    }

    const fromFullName = byFullName.get(key) ?? fromSurname;
    if (fromFullName) {
      return { ...line, status: "suggest", nickname: fromFullName, suggestions: [fromFullName] };
    }

    const close = players
      .map((player) => ({ nickname: player.nickname, d: distance(key, nameKey(player.nickname)) }))
      .filter(({ nickname, d }) => {
        const other = nameKey(nickname);
        return (
          d <= (key.length >= 5 ? 2 : 1) ||
          (key.length >= 3 && (other.startsWith(key) || key.startsWith(other)))
        );
      })
      .sort((a, b) => a.d - b.d || a.nickname.localeCompare(b.nickname))
      .slice(0, 3)
      .map(({ nickname }) => nickname);
    return { ...line, status: "unknown", nickname: null, suggestions: close };
  });
}

/** The pasted text with one numbered line rewritten to an official nickname, keeping its number and role. */
export function rewriteLine(input: string, line: SignupLine, nickname: string): string {
  const rows = input.split(/\r?\n/);
  if (line.lineIndex < 0 || line.lineIndex >= rows.length) return input;
  rows[line.lineIndex] = `${line.number}. ${line.role ? `${line.role}: ` : ""}${nickname}`;
  return rows.join("\n");
}

/** The pasted text with one numbered line taken out, e.g. a name listed twice. */
export function removeLine(input: string, line: SignupLine): string {
  const rows = input.split(/\r?\n/);
  if (line.lineIndex < 0 || line.lineIndex >= rows.length) return input;
  rows.splice(line.lineIndex, 1);
  return rows.join("\n");
}

/** Lines that still need fixing before a game day can be created. */
export function blockingLines(lines: ResolvedLine[]): ResolvedLine[] {
  return lines.filter((line) => !line.waitlist && line.status !== "ok");
}

/** Longest officer name a game day stores (`queueMasterName` / `financeMemberName`). */
export const OFFICER_NAME_MAX = 60;

/**
 * Everyone listed with a role, e.g. two `QM:` lines on one game day. Joins their nicknames as
 * "Roniel & Jgops" (or "A, B & C"), without repeats, trimmed to whole names that fit in
 * `OFFICER_NAME_MAX`. Null when nobody has the role.
 */
export function officerNames(
  lines: Array<{ role?: SignupRole | null; nickname?: string | null }>,
  role: SignupRole,
): string | null {
  const names: string[] = [];
  for (const line of lines) {
    const name = line.role === role ? line.nickname?.trim() : null;
    if (name && !names.includes(name)) names.push(name);
  }
  while (names.length > 1 && joinNames(names).length > OFFICER_NAME_MAX) names.pop();
  return names.length > 0 ? joinNames(names).slice(0, OFFICER_NAME_MAX) : null;
}

function joinNames(names: string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}

/** "Queue master" or "Queue masters", depending on whether the stored name lists more than one. */
export function officerLabel(singular: string, name: string | null | undefined): string {
  return name && / & /.test(name) ? `${singular}s` : singular;
}

/**
 * The official nickname a queue master typed by hand for a flagged line, matched without
 * regard to case or spacing ("jax " → "Jax"), or null when no player has it.
 */
export function findNickname(input: string, players: Array<{ nickname: string }>): string | null {
  const key = nameKey(input);
  if (!key) return null;
  return players.find((player) => nameKey(player.nickname) === key)?.nickname ?? null;
}
