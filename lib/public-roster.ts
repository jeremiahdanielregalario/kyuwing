/**
 * The public, view-only roster (`/roster`), linked from the landing page and the live view.
 *
 * Shows what the club agreed to share: nickname, full name, level, player type, playing
 * recency with attendance history, and tournament awards. Never contacts or notes. Archived
 * players are included with `archived: true`, so the page can hide them until someone presses
 * "Show archived". Database ids are replaced by short aliases.
 * Pure, so it can be unit-tested for leaks.
 */
import type { PlayerAward } from "./awards";
import type { AttendanceOverview, AwardsOverview, PlayerHistoryItem, TournamentDto } from "./queries";
import type { RecencySnapshot } from "./recency";

type Category = "ACTIVE" | "INACTIVE" | "ALUMNI" | "APPLICANT" | "NON_AFFILIATE";

export type PublicRosterPlayer = {
  /** An alias like "r12", not the database id. */
  id: string;
  nickname: string;
  fullName: string | null;
  level: string;
  category: Category;
  /** Archived from the roster; hidden on the page until "Show archived" is pressed. */
  archived: boolean;
};

export type PublicRoster = {
  players: PublicRosterPlayer[];
  recency: Record<string, RecencySnapshot>;
  history: Record<string, PlayerHistoryItem[]>;
  awards: Record<string, PlayerAward[]>;
  events: AttendanceOverview["events"];
  tournaments: TournamentDto[];
};

export function toPublicRoster(
  players: Array<{
    id: string;
    nickname: string;
    fullName: string | null;
    level: string;
    category: Category;
    active: boolean;
  }>,
  attendance: AttendanceOverview,
  awards: AwardsOverview,
): PublicRoster {
  const shown = [...players].sort((a, b) =>
    a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" }),
  );

  const roster: PublicRoster = {
    players: [],
    recency: {},
    history: {},
    awards: {},
    events: attendance.events,
    tournaments: awards.tournaments,
  };
  shown.forEach((player, index) => {
    const alias = `r${index + 1}`;
    // Field by field on purpose: a new private column on Player must not show up here by accident.
    roster.players.push({
      id: alias,
      nickname: player.nickname,
      fullName: player.fullName?.trim() || null,
      level: player.level,
      category: player.category,
      archived: !player.active,
    });
    const recency = attendance.byPlayer[player.id];
    if (recency) roster.recency[alias] = recency;
    const history = attendance.historyByPlayer[player.id];
    if (history) roster.history[alias] = history;
    const won = awards.byPlayer[player.id];
    if (won) roster.awards[alias] = won;
  });
  return roster;
}
