/**
 * Tournament podiums: parsing a pasted results message and mapping awards to players.
 * Pure and DB-free so it can be unit-tested and shared by the form preview and the server.
 */

export type AwardPlace = "CHAMPION" | "RUNNER_UP";

export const AWARD_PLACE_LABELS: Record<AwardPlace, string> = {
  CHAMPION: "Champion",
  RUNNER_UP: "Runner-up",
};

export type ParsedResult = { place: AwardPlace; names: string[] };
export type ParsedDivision = { name: string; results: ParsedResult[] };
export type ParsedAwards = {
  /** A line before the first division, e.g. "High Tide 2026". Used when no name is typed. */
  title: string | null;
  divisions: ParsedDivision[];
  errors: string[];
};

const CHAMPION =
  /^(?:champions?|champs?|winners?|gold|1st(?:\s+place)?|first(?:\s+place)?)\s*[:\-–—]\s*(.+)$/i;
const RUNNER_UP =
  /^(?:runners?[\s-]*ups?|silver|finalists?|2nd(?:\s+place)?|second(?:\s+place)?)\s*[:\-–—]\s*(.+)$/i;

/** Most players a podium team can list: a doubles pair, or a whole team in team-format tournaments. */
export const MAX_TEAM_SIZE = 8;

/**
 * "Chons & Jced", "Chons and Jced", "Chons / Jced" → ["Chons", "Jced"]; "EJ, Jethro, Don, Eljo" is a
 * team. A single name is a singles podium.
 */
export function splitTeam(text: string): string[] {
  return text
    .split(/\s*(?:&|\/|\+|,|\band\b)\s*/i)
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * Reads a results message like:
 *
 *   High Tide 2026
 *   Level A
 *   Champions: Chons & Jced
 *   Runner Up: PJ & Ben
 *
 * Any other line starts a new division. Lines before the first division become the title.
 */
export function parseAwardsText(text: string): ParsedAwards {
  const divisions: ParsedDivision[] = [];
  const errors: string[] = [];
  const titleLines: string[] = [];
  let current: ParsedDivision | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw
      .replace(/^[\s*•\-–—]+/, "")
      .replace(/[*_]/g, "")
      .trim();
    if (!line) continue;
    const champion = line.match(CHAMPION);
    const runnerUp = champion ? null : line.match(RUNNER_UP);
    const hit = champion ?? runnerUp;
    if (!hit) {
      // A new heading. A heading right after another empty heading is part of the title.
      if (current && current.results.length === 0) {
        if (divisions.length === 1) titleLines.push(current.name);
        divisions.pop();
      }
      current = { name: line, results: [] };
      divisions.push(current);
      continue;
    }
    const place: AwardPlace = champion ? "CHAMPION" : "RUNNER_UP";
    const names = splitTeam(hit[1]);
    if (!current) {
      errors.push(`Add a level line (like "Level A") before "${line}".`);
      continue;
    }
    if (names.length === 0 || names.length > MAX_TEAM_SIZE) {
      errors.push(
        `${current.name}: "${hit[1]}" should be 1 to ${MAX_TEAM_SIZE} nicknames, like "Chons & Jced" or "EJ, Jethro, Don, Eljo".`,
      );
      continue;
    }
    if (current.results.some((result) => result.place === place)) {
      errors.push(`${current.name} has two ${AWARD_PLACE_LABELS[place].toLowerCase()} lines.`);
      continue;
    }
    current.results.push({ place, names });
  }

  // A trailing heading with no results is not a division.
  if (current && current.results.length === 0) {
    divisions.pop();
    if (divisions.length === 0) titleLines.push(current.name);
  }
  if (divisions.length === 0 && errors.length === 0) {
    errors.push('No results found. Use lines like "Champions: Chons & Jced" under each level.');
  }
  return { title: titleLines.join(" ") || null, divisions, errors };
}

export type AwardRow = {
  tournamentId: string;
  tournament: string;
  date: string;
  division: string;
  place: AwardPlace;
  position: number;
  players: { id: string; nickname: string }[];
};

/** One award as one player sees it: where, what, and who they played with. */
export type PlayerAward = {
  tournamentId: string;
  tournament: string;
  date: string;
  division: string;
  place: AwardPlace;
  /** Their doubles partner, or every teammate in a team-format tournament, in listed order. */
  teammates: string[];
};

/** Every player's awards, newest tournament first, champions before runners-up. */
export function awardsByPlayer(rows: AwardRow[]): Record<string, PlayerAward[]> {
  const sorted = [...rows].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.tournament.localeCompare(b.tournament) ||
      a.position - b.position ||
      (a.place === b.place ? 0 : a.place === "CHAMPION" ? -1 : 1),
  );
  const out: Record<string, PlayerAward[]> = {};
  for (const row of sorted) {
    for (const player of row.players) {
      (out[player.id] ??= []).push({
        tournamentId: row.tournamentId,
        tournament: row.tournament,
        date: row.date,
        division: row.division,
        place: row.place,
        teammates: row.players.filter((other) => other.id !== player.id).map((other) => other.nickname),
      });
    }
  }
  return out;
}

/** "PJ", "PJ & Ben", "EJ, Jethro, Don & Eljo". */
export function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" & ");
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}
