import { bracketGap, bracketIndex, isUnrated, levelValue } from "./levels";

export type PairingRequestKind = "PAIR_WITH" | "PLAY_AGAINST";

export type PairingRequest = {
  type: PairingRequestKind;
  targetPlayerId: string;
};

export type PairingPlayer = {
  id: string;
  nickname: string;
  level: string;
  waitMinutes: number;
  gamesPlayed: number;
  priority?: boolean;
  permanentPartnerId?: string | null;
  requests?: PairingRequest[];
};

export type PairingHistoryMatch = {
  round: number;
  playerIds: string[];
  team1: string[];
  team2: string[];
};

export type PairingOptions = {
  /** How many candidates to consider per match. More = better but slower. */
  maxPool?: number;
  /** Recent rounds where a repeat is penalised hardest. */
  repeatWindow?: number;
  /** Allow (and soften the penalty for) cross-bracket pairings. */
  scarcity?: boolean;
  /** The round number the new match will use. */
  round?: number;
  /** Players who must be in the match, e.g. everyone already waiting when planning ahead. */
  mustInclude?: string[];
  /**
   * Where the queue master put some players (1 or 2 = a side of the net). Players given the
   * same side stay partners, different sides stay opponents, and the returned teams are
   * oriented to match. Used when a court is started by hand and the engine fills the rest.
   */
  sides?: Record<string, 1 | 2>;
  /**
   * Asks for a different answer than the best one, for "regenerate". The seed
   * adds a small, repeatable shake to the scores so near-equal arrangements
   * trade places, and `avoid` lists arrangements (see `arrangementKey`) that
   * must not come back. Without it the engine is fully deterministic.
   */
  variety?: { seed: number; avoid?: string[] };
};

export type PairingSuggestion = {
  team1: PairingPlayer[];
  team2: PairingPlayer[];
  playerIds: string[];
  cost: number;
  balance: number;
  averageWaitMinutes: number;
  reasons: string[];
  crossBracket: boolean;
  honorsRequest: boolean;
  keepsPermanentPair: boolean;
};

const TEAM_DIFF_WEIGHT = 48;
const CROSS_BRACKET_WEIGHT = 55;
const INTRA_GAP_WEIGHT = 5;
const REPEAT_TEAMMATE_WEIGHT = 150;
const RECENT_TEAMMATE_WEIGHT = 110;
const REPEAT_OPPONENT_WEIGHT = 20;
const RECENT_OPPONENT_WEIGHT = 14;
const REPEAT_FOURSOME_WEIGHT = 260;
const WAIT_WEIGHT = 1.15;
/** Largest score shake `variety` adds. Under one level step, so fairness stays intact. */
const VARIETY_SHAKE = 30;

/** Who plays with whom, ignoring which side of the net is "team 1". */
export function arrangementKey(team1: string[], team2: string[]): string {
  const side = (ids: string[]) => [...ids].sort().join("+");
  return [side(team1), side(team2)].sort().join("|");
}

/** Repeatable pseudo-random number in [0, 1) for a seed and a label. */
function shake(seed: number, label: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < label.length; i += 1) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
const GAMES_WEIGHT = 17;
const PRIORITY_WEIGHT = 90;
const HONOR_PAIR_WEIGHT = 135;
const HONOR_AGAINST_WEIGHT = 115;
const VIOLATE_PAIR_WEIGHT = 95;
const VIOLATE_AGAINST_WEIGHT = 80;

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function unitKey(ids: string[]) {
  return [...ids].sort().join("|");
}

function sortPlayers(players: PairingPlayer[]) {
  return [...players].sort((a, b) => {
    if (Boolean(a.priority) !== Boolean(b.priority)) return a.priority ? -1 : 1;
    if (b.waitMinutes !== a.waitMinutes) return b.waitMinutes - a.waitMinutes;
    if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
    return a.nickname.localeCompare(b.nickname);
  });
}

function buildPool(players: PairingPlayer[], maxPool: number): PairingPlayer[] {
  const ordered = sortPlayers(players);
  const pool = ordered.slice(0, maxPool);
  const poolIds = new Set(pool.map((player) => player.id));
  const byId = new Map(players.map((player) => [player.id, player]));

  // Never split a mutual permanent pair just because one partner has waited less.
  for (const player of [...pool]) {
    const partnerId = player.permanentPartnerId;
    if (!partnerId || poolIds.has(partnerId)) continue;
    const partner = byId.get(partnerId);
    if (partner && partner.permanentPartnerId === player.id) {
      pool.push(partner);
      poolIds.add(partner.id);
    }
  }

  return pool;
}

function buildUnits(players: PairingPlayer[]) {
  const byId = new Map(players.map((player) => [player.id, player]));
  const seen = new Set<string>();
  const units: PairingPlayer[][] = [];

  for (const player of sortPlayers(players)) {
    if (seen.has(player.id)) continue;

    const partnerId = player.permanentPartnerId;
    const partner = partnerId ? byId.get(partnerId) : undefined;
    if (partner && partner.permanentPartnerId === player.id) {
      units.push([player, partner]);
      seen.add(player.id);
      seen.add(partner.id);
    } else {
      units.push([player]);
      seen.add(player.id);
    }
  }

  return units;
}

/** All combinations of units that add up to exactly four players. */
function chooseUnits(units: PairingPlayer[][], limit = 6000): PairingPlayer[][] {
  const results: PairingPlayer[][] = [];
  const chosen: PairingPlayer[] = [];

  function walk(index: number, size: number) {
    if (results.length >= limit) return;
    if (size === 4) {
      results.push([...chosen]);
      return;
    }
    if (index >= units.length || size > 4) return;

    // Prune when even taking every remaining unit cannot reach four.
    let remaining = 0;
    for (let i = index; i < units.length; i += 1) remaining += units[i].length;
    if (size + remaining < 4) return;

    const unit = units[index];
    if (size + unit.length <= 4) {
      chosen.push(...unit);
      walk(index + 1, size + unit.length);
      chosen.splice(chosen.length - unit.length, unit.length);
    }
    walk(index + 1, size);
  }

  walk(0, 0);
  return results;
}

type HistoryIndex = {
  teammate: Map<string, { count: number; lastRound: number }>;
  opponent: Map<string, { count: number; lastRound: number }>;
  foursome: Map<string, { count: number; lastRound: number }>;
};

function indexHistory(history: PairingHistoryMatch[]): HistoryIndex {
  const teammate = new Map<string, { count: number; lastRound: number }>();
  const opponent = new Map<string, { count: number; lastRound: number }>();
  const foursome = new Map<string, { count: number; lastRound: number }>();

  const bump = (map: Map<string, { count: number; lastRound: number }>, key: string, round: number) => {
    const current = map.get(key);
    map.set(key, {
      count: (current?.count ?? 0) + 1,
      lastRound: Math.max(current?.lastRound ?? 0, round),
    });
  };

  for (const match of history) {
    for (const team of [match.team1, match.team2]) {
      for (let i = 0; i < team.length; i += 1) {
        for (let j = i + 1; j < team.length; j += 1) {
          bump(teammate, pairKey(team[i], team[j]), match.round);
        }
      }
    }
    for (const a of match.team1) {
      for (const b of match.team2) {
        bump(opponent, pairKey(a, b), match.round);
      }
    }
    bump(foursome, unitKey(match.playerIds), match.round);
  }

  return { teammate, opponent, foursome };
}

type Evaluation = {
  suggestion: PairingSuggestion;
};

function evaluateMatch(
  team1: PairingPlayer[],
  team2: PairingPlayer[],
  historyIndex: HistoryIndex,
  options: Required<Pick<PairingOptions, "scarcity" | "repeatWindow" | "round">>,
): Evaluation {
  const all = [...team1, ...team2];
  const values1 = team1.reduce((sum, player) => sum + levelValue(player.level), 0);
  const values2 = team2.reduce((sum, player) => sum + levelValue(player.level), 0);
  const balance = Math.abs(values1 - values2);

  let cost = balance * TEAM_DIFF_WEIGHT;
  let crossBracket = false;
  let keepsPermanentPair = false;
  let honorsRequest = false;

  const teammateMap = new Map<string, PairingPlayer[]>();
  const opponentMap = new Map<string, PairingPlayer[]>();

  for (const team of [team1, team2]) {
    for (let i = 0; i < team.length; i += 1) {
      for (let j = i + 1; j < team.length; j += 1) {
        const a = team[i];
        const b = team[j];
        const gap = bracketGap(a.level, b.level);
        const numericGap = Math.abs(levelValue(a.level) - levelValue(b.level));
        const bracketPenalty = Math.max(0, gap - 1) * CROSS_BRACKET_WEIGHT * (options.scarcity ? 0.2 : 1);
        const numericPenalty = Math.max(0, numericGap - 3) * INTRA_GAP_WEIGHT;
        if (gap > 1) crossBracket = true;
        cost += bracketPenalty + numericPenalty;

        const key = pairKey(a.id, b.id);
        if (!teammateMap.has(key)) teammateMap.set(key, []);
        teammateMap.get(key)!.push(a, b);

        if (a.permanentPartnerId === b.id && b.permanentPartnerId === a.id) {
          keepsPermanentPair = true;
        }
      }
    }
  }

  for (const a of team1) {
    for (const b of team2) {
      const key = pairKey(a.id, b.id);
      if (!opponentMap.has(key)) opponentMap.set(key, []);
      opponentMap.get(key)!.push(a, b);
    }
  }

  // Repeat pairings.
  for (const [key, pair] of teammateMap) {
    const record = historyIndex.teammate.get(key);
    if (!record) continue;
    cost += record.count * REPEAT_TEAMMATE_WEIGHT;
    const distance = options.round - record.lastRound;
    if (distance > 0 && distance <= options.repeatWindow) cost += RECENT_TEAMMATE_WEIGHT;
    void pair;
  }
  for (const [key] of opponentMap) {
    const record = historyIndex.opponent.get(key);
    if (!record) continue;
    cost += record.count * REPEAT_OPPONENT_WEIGHT;
    const distance = options.round - record.lastRound;
    if (distance > 0 && distance <= options.repeatWindow) cost += RECENT_OPPONENT_WEIGHT;
  }

  const foursome = historyIndex.foursome.get(unitKey(all.map((player) => player.id)));
  if (foursome) {
    cost += REPEAT_FOURSOME_WEIGHT * foursome.count;
    if (options.round - foursome.lastRound <= options.repeatWindow) cost += REPEAT_FOURSOME_WEIGHT / 2;
  }

  // Requests.
  const pairEdges = new Set<string>();
  const againstEdges = new Set<string>();
  const present = new Set(all.map((player) => player.id));
  for (const player of all) {
    for (const request of player.requests ?? []) {
      if (!present.has(request.targetPlayerId)) continue;
      const key = pairKey(player.id, request.targetPlayerId);
      if (request.type === "PAIR_WITH") pairEdges.add(key);
      if (request.type === "PLAY_AGAINST") againstEdges.add(key);
    }
  }

  for (const [key] of teammateMap) {
    if (pairEdges.has(key)) {
      cost -= HONOR_PAIR_WEIGHT;
      honorsRequest = true;
    }
    if (againstEdges.has(key)) cost += VIOLATE_AGAINST_WEIGHT;
  }
  for (const [key] of opponentMap) {
    if (againstEdges.has(key)) {
      cost -= HONOR_AGAINST_WEIGHT;
      honorsRequest = true;
    }
    if (pairEdges.has(key)) cost += VIOLATE_PAIR_WEIGHT;
  }

  // Wait + games fairness.
  for (const player of all) {
    cost -= Math.min(120, player.waitMinutes) * WAIT_WEIGHT;
    cost += player.gamesPlayed * GAMES_WEIGHT;
    if (player.priority) cost -= PRIORITY_WEIGHT;
  }

  const averageWaitMinutes = Math.round(all.reduce((sum, player) => sum + player.waitMinutes, 0) / 4);
  const reasons: string[] = [];

  if (keepsPermanentPair) reasons.push("Permanent pair kept");
  if (balance === 0) reasons.push("Teams level on paper");
  else if (balance <= 2) reasons.push("Tight team balance");
  else if (balance <= 4) reasons.push("Teams within reach");

  const maxTeammateBracketGap = Math.max(
    bracketGap(team1[0].level, team1[1].level),
    bracketGap(team2[0].level, team2[1].level),
  );
  if (maxTeammateBracketGap <= 1) reasons.push("Same-bracket pairings");
  else if (options.scarcity) reasons.push("Cross-bracket fill for scarcity");

  if (honorsRequest) reasons.push("Player request honored");

  const hasRepeatTeammate = [...teammateMap.keys()].some((key) => historyIndex.teammate.has(key));
  const hasRepeatFoursome = Boolean(foursome);
  if (!hasRepeatTeammate && !hasRepeatFoursome) reasons.push("Fresh foursome");

  const topWaits = [...all].sort((a, b) => b.waitMinutes - a.waitMinutes);
  if (topWaits[0].waitMinutes >= 20)
    reasons.push(`Longest wait: ${topWaits[0].nickname} (${topWaits[0].waitMinutes}m)`);
  if (all.some((player) => player.priority)) reasons.push("Priority player seated");

  const bracketSpread =
    Math.max(...all.map((player) => bracketIndex(player.level))) -
    Math.min(...all.map((player) => bracketIndex(player.level)));
  if (bracketSpread <= 1 && !reasons.includes("Same-bracket pairings")) reasons.push("Same-bracket match");

  return {
    suggestion: {
      team1,
      team2,
      playerIds: all.map((player) => player.id),
      cost: Math.round(cost * 100) / 100,
      balance,
      averageWaitMinutes,
      reasons: reasons.slice(0, 4),
      crossBracket,
      honorsRequest,
      keepsPermanentPair,
    },
  };
}

/**
 * Picks the single best match from the available players.
 *
 * The score is a weighted cost (lower is better): team strength gap, bracket
 * spread, repeated pairings, player requests, waiting time and games played.
 */
export function findBestMatch(
  candidates: PairingPlayer[],
  history: PairingHistoryMatch[] = [],
  options: PairingOptions = {},
): PairingSuggestion | null {
  // An unrated ("X") player is never picked by the engine: their strength is unknown, so any
  // balance would be a guess. They only play when the queue master places them by hand.
  const placed = new Set([...(options.mustInclude ?? []), ...Object.keys(options.sides ?? {})]);
  const players = candidates.filter((player) => !isUnrated(player.level) || placed.has(player.id));
  if (players.length < 4) return null;

  const scarcity = options.scarcity ?? players.length < 8;
  const maxPool = Math.max(4, Math.min(options.maxPool ?? 14, players.length));
  const pool = buildPool(players, maxPool);
  if (pool.length < 4) return null;

  const units = buildUnits(pool);
  const combos = chooseUnits(units);
  if (combos.length === 0) return null;

  const historyIndex = indexHistory(history);
  const round = options.round ?? Math.max(0, ...history.map((match) => match.round)) + 1;
  const evaluationOptions = {
    scarcity,
    repeatWindow: options.repeatWindow ?? 3,
    round,
  };

  const partitions: Array<[number[], number[]]> = [
    [
      [0, 1],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 3],
    ],
    [
      [0, 3],
      [1, 2],
    ],
  ];

  let best: PairingSuggestion | null = null;

  for (const combo of combos) {
    if (options.mustInclude?.some((id) => !combo.some((candidate) => candidate.id === id))) continue;
    for (const [left, right] of partitions) {
      const team1 = left.map((index) => combo[index]);
      const team2 = right.map((index) => combo[index]);

      // Players placed by hand keep their partners and their opponents.
      if (options.sides) {
        const placed = combo.filter((candidate) => options.sides![candidate.id] !== undefined);
        let consistent = true;
        for (let i = 0; i < placed.length && consistent; i += 1) {
          for (let j = i + 1; j < placed.length; j += 1) {
            const together = team1.includes(placed[i]) === team1.includes(placed[j]);
            const wantTogether = options.sides[placed[i].id] === options.sides[placed[j].id];
            if (together !== wantTogether) {
              consistent = false;
              break;
            }
          }
        }
        if (!consistent) continue;
      }

      // A permanent pair must stay on the same side of the net.
      let valid = true;
      for (const team of [team1, team2]) {
        for (const player of team) {
          const partnerId = player.permanentPartnerId;
          if (!partnerId) continue;
          const partnerInMatch = combo.find((candidate) => candidate.id === partnerId);
          if (
            partnerInMatch &&
            partnerInMatch.permanentPartnerId === player.id &&
            !team.includes(partnerInMatch)
          ) {
            valid = false;
          }
        }
      }
      if (!valid) continue;

      const { suggestion } = evaluateMatch(team1, team2, historyIndex, evaluationOptions);
      if (options.variety) {
        const key = arrangementKey(
          team1.map((player) => player.id),
          team2.map((player) => player.id),
        );
        if (options.variety.avoid?.includes(key)) continue;
        suggestion.cost += shake(options.variety.seed, key) * VARIETY_SHAKE;
      }
      if (
        !best ||
        suggestion.cost < best.cost ||
        (suggestion.cost === best.cost && suggestion.averageWaitMinutes > best.averageWaitMinutes)
      ) {
        best = suggestion;
      }
    }
  }

  // Show the placed players on the side they were put on.
  if (best && options.sides) {
    const anchor = [...best.team1, ...best.team2].find(
      (candidate) => options.sides![candidate.id] !== undefined,
    );
    if (anchor && best.team1.includes(anchor) !== (options.sides[anchor.id] === 1)) {
      [best.team1, best.team2] = [best.team2, best.team1];
    }
  }

  return best;
}

/**
 * Fills several courts at once. Players chosen for an earlier court are not
 * offered again, which keeps the queue moving without duplicate assignments.
 */
export function suggestMatches(
  players: PairingPlayer[],
  history: PairingHistoryMatch[] = [],
  options: PairingOptions & { courts?: number } = {},
): PairingSuggestion[] {
  const courts = Math.max(1, Math.min(options.courts ?? 1, 12));
  let remaining = [...players];
  const suggestions: PairingSuggestion[] = [];

  for (let court = 0; court < courts; court += 1) {
    if (remaining.length < 4) break;
    const suggestion = findBestMatch(remaining, history, {
      ...options,
      scarcity: options.scarcity ?? remaining.length < 8,
    });
    if (!suggestion) break;
    suggestions.push(suggestion);
    const used = new Set(suggestion.playerIds);
    remaining = remaining.filter((player) => !used.has(player.id));
  }

  return suggestions;
}
