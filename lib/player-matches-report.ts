import type { BoardMatch, BoardMatchPlayer, FeeReport } from "@/lib/board-types";
import { levelLabel } from "@/lib/levels";

/**
 * Rows for the report's "Matches per player" sheet: each player's finished games in the order
 * they were played, with partner and opponents. Pure so it can be unit-tested.
 */

export type PlayerMatchLine = {
  /** 1-based game number for this player today, counting free games too. */
  number: number;
  round: number;
  courtNumber: number;
  partner: string;
  opponents: string;
  startedAt: string | null;
  endedAt: string | null;
  free: boolean;
};

export type PlayerMatchesBlock = {
  sessionPlayerId: string;
  nickname: string;
  levelLabel: string;
  /** Counted games, as billed. Free games are listed but not counted here. */
  gamesPlayed: number;
  lines: PlayerMatchLine[];
};

const label = (player: BoardMatchPlayer) => `${player.nickname} (${player.levelLabel})`;

function lineFor(match: BoardMatch, sessionPlayerId: string, number: number): PlayerMatchLine | null {
  const onTeam1 = match.team1.some((player) => player.sessionPlayerId === sessionPlayerId);
  const onTeam2 = match.team2.some((player) => player.sessionPlayerId === sessionPlayerId);
  if (!onTeam1 && !onTeam2) return null;
  const own = onTeam1 ? match.team1 : match.team2;
  const other = onTeam1 ? match.team2 : match.team1;
  return {
    number,
    round: match.round,
    courtNumber: match.courtNumber,
    partner: own
      .filter((player) => player.sessionPlayerId !== sessionPlayerId)
      .map(label)
      .join(" & "),
    opponents: other.map(label).join(" & "),
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    free: match.free,
  };
}

const byTimeAsc = (a: BoardMatch, b: BoardMatch) =>
  (a.startedAt ?? a.endedAt ?? "").localeCompare(b.startedAt ?? b.endedAt ?? "") ||
  a.round - b.round ||
  a.courtNumber - b.courtNumber;

/**
 * One block per player, A to Z, for everyone who played or was checked in. Players still only
 * expected (never checked in) with no games are left out.
 */
export function playerMatchesReport(report: FeeReport): PlayerMatchesBlock[] {
  const matches = report.matches.filter((match) => match.status === "COMPLETED").sort(byTimeAsc);
  return [...report.rows]
    .sort((a, b) => a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" }))
    .flatMap((row) => {
      const lines: PlayerMatchLine[] = [];
      for (const match of matches) {
        const line = lineFor(match, row.sessionPlayerId, lines.length + 1);
        if (line) lines.push(line);
      }
      if (lines.length === 0 && row.status === "EXPECTED") return [];
      return [
        {
          sessionPlayerId: row.sessionPlayerId,
          nickname: row.nickname,
          levelLabel: levelLabel(row.level),
          gamesPlayed: row.gamesPlayed,
          lines,
        },
      ];
    });
}
