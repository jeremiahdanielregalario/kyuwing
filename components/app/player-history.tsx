"use client";

import { CircleCheck, Gift } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { formatClock } from "@/lib/datetime";
import type { BoardMatch } from "@/lib/board-types";
import { cn } from "@/lib/utils";

function minutesBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
}

/**
 * A player's games today: who they partnered and played against, on which court, and when.
 * `matches` comes from `playerMatches` (the game on court first, then newest first).
 */
export function PlayerHistoryDialog({
  open,
  onClose,
  playerId,
  nickname,
  matches,
  courtLabel,
}: {
  open: boolean;
  onClose: () => void;
  playerId: string;
  nickname: string;
  matches: BoardMatch[];
  courtLabel: (courtNumber: number) => string;
}) {
  const finished = matches.filter((match) => match.status === "COMPLETED");
  const counted = finished.filter((match) => !match.free).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${nickname}'s games`}
      description={
        matches.length === 0
          ? "No games yet today."
          : `${counted} ${counted === 1 ? "game" : "games"} played${
              finished.length > counted ? `, plus ${finished.length - counted} free` : ""
            }${matches.some((match) => match.status === "LIVE") ? ", one on court now" : ""}.`
      }
    >
      {matches.length > 0 && (
        <ol className="space-y-2">
          {matches.map((match) => {
            const mine = match.team1.some((row) => row.playerId === playerId) ? match.team1 : match.team2;
            const theirs = mine === match.team1 ? match.team2 : match.team1;
            const partners = mine.filter((row) => row.playerId !== playerId).map((row) => row.nickname);
            const live = match.status === "LIVE";
            const number = live ? null : finished.length - finished.indexOf(match);
            const length = minutesBetween(match.startedAt, match.endedAt);
            return (
              <li
                key={match.id}
                className={cn(
                  "rounded-xl border px-3 py-2.5",
                  live ? "border-forest/50 bg-lime/15" : "border-line bg-paper",
                )}
              >
                <div className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                  <span className="text-ink font-mono font-bold">
                    {live ? "On court now" : `Game ${number}`}
                  </span>
                  <span>{courtLabel(match.courtNumber)}</span>
                  {match.startedAt && (
                    <span className="font-mono">
                      {formatClock(match.startedAt)}
                      {match.endedAt ? ` – ${formatClock(match.endedAt)}` : ""}
                    </span>
                  )}
                  {length !== null && <span className="font-mono">{length} min</span>}
                  {match.free && (
                    <span
                      title="Free game — used shuttle, not counted"
                      className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold tracking-wider text-violet-900 uppercase"
                    >
                      <Gift className="h-2.5 w-2.5" /> Free
                    </span>
                  )}
                  {!live && <CircleCheck className="text-forest ml-auto h-3.5 w-3.5" aria-hidden="true" />}
                </div>
                <p className="mt-1 text-[14px] leading-snug">
                  <span className="font-bold">{[nickname, ...partners].join(" & ")}</span>
                  <span className="text-muted mx-1.5 text-[12px]">vs</span>
                  <span className="font-semibold">{theirs.map((row) => row.nickname).join(" & ")}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
