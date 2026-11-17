"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, CircleCheck, FileText, Gift, Pencil, Search } from "lucide-react";
import type { MatchRecord } from "@/lib/board-engine/matches";
import type { BoardMatch, BoardPlayer } from "@/lib/board-types";
import { formatClock } from "@/lib/datetime";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

/** How a finished game counts, from the board's match DTO. */
export function matchRecord(match: Pick<BoardMatch, "status" | "free">): MatchRecord {
  if (match.status !== "COMPLETED") return "unrecorded";
  return match.free ? "free" : "counted";
}

const RECORDS: Array<{ value: MatchRecord; label: string; hint: string; icon: React.ReactNode }> = [
  {
    value: "counted",
    label: "Counted",
    hint: "Counts as a game for all four, and toward their fees",
    icon: <CircleCheck className="h-3.5 w-3.5" />,
  },
  {
    value: "free",
    label: "Free",
    hint: "Played (e.g. with a used shuttle) but not counted or charged",
    icon: <Gift className="h-3.5 w-3.5" />,
  },
  {
    value: "unrecorded",
    label: "Not recorded",
    hint: "Didn't really happen: not counted, and left out of the reports and pairing history",
    icon: <Ban className="h-3.5 w-3.5" />,
  },
];

function minutesBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
}

/**
 * Every game played today, newest first, with what the queue master can fix afterwards: whether
 * it counts (counted, free or not recorded) and who played it.
 */
export function MatchHistoryDialog({
  open,
  onClose,
  matches,
  players,
  courtLabel,
  reportsHref,
  locked,
  pending,
  focusId,
  onSetRecord,
  onEditPlayers,
}: {
  open: boolean;
  onClose: () => void;
  /** From `gameHistory`: finished games, newest first, including ones not recorded. */
  matches: BoardMatch[];
  /** Everyone on the game day; only those checked in can be put into a game. */
  players: BoardPlayer[];
  courtLabel: (courtNumber: number) => string;
  reportsHref: string;
  /** The game day is closed: show the games but don't offer changes. */
  locked: boolean;
  pending: boolean;
  /** A game to scroll to and highlight when the dialog opens. */
  focusId?: string | null;
  onSetRecord: (matchId: string, record: MatchRecord) => void;
  onEditPlayers: (matchId: string, team1: string[], team2: string[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<{ id: string; slots: string[] } | null>(null);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? matches.filter((match) =>
        [...match.team1, ...match.team2].some((row) => row.nickname.toLowerCase().includes(needle)),
      )
    : matches;
  const counts = { counted: 0, free: 0, unrecorded: 0 };
  for (const match of matches) counts[matchRecord(match)] += 1;
  // Numbered oldest first among recorded games, like the player's own history.
  const recorded = matches.filter((match) => matchRecord(match) !== "unrecorded");

  const choices = players
    .filter((player) => player.status !== "EXPECTED")
    .sort((a, b) => a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" }));

  const scrollTo = React.useCallback(
    (node: HTMLLIElement | null) => {
      if (node && focusId) node.scrollIntoView({ block: "center" });
    },
    [focusId],
  );

  const close = () => {
    setEditing(null);
    setQuery("");
    onClose();
  };

  const description =
    matches.length === 0
      ? "No finished games yet today."
      : [
          `${counts.counted} counted`,
          counts.free ? `${counts.free} free` : null,
          counts.unrecorded ? `${counts.unrecorded} not recorded` : null,
        ]
          .filter(Boolean)
          .join(" · ") +
        (locked
          ? ". The game day is closed; reopen it in Settings to change a game."
          : ". Change how a game counts, or fix who played it.");

  return (
    <Modal
      open={open}
      onClose={close}
      title="Match history"
      description={description}
      size="lg"
      footer={
        <>
          <Link href={reportsHref} className={buttonVariants({ variant: "ghost" })}>
            <FileText className="h-4 w-4" /> Reports
          </Link>
          <Button variant="paper" onClick={close}>
            Done
          </Button>
        </>
      }
    >
      {matches.length > 3 && (
        <label className="relative mb-3 block">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a player"
            aria-label="Find a player"
            className="pl-10"
          />
        </label>
      )}
      {shown.length === 0 && matches.length > 0 && (
        <p className="text-muted text-[13px]">No games with that player.</p>
      )}
      <ol className="space-y-2">
        {shown.map((match) => {
          const record = matchRecord(match);
          const number = record === "unrecorded" ? null : recorded.length - recorded.indexOf(match);
          const length = minutesBetween(match.startedAt, match.endedAt);
          const lineup = [...match.team1, ...match.team2].map((row) => row.playerId);
          const isEditing = editing?.id === match.id;
          const focused = focusId === match.id;
          return (
            <li
              key={match.id}
              ref={focused ? scrollTo : undefined}
              className={cn(
                "rounded-xl border px-3 py-2.5",
                record === "unrecorded" ? "border-line/70 bg-cream/40" : "border-line bg-paper",
                focused && "ring-lime ring-2",
              )}
            >
              <div className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <span className="text-ink font-mono font-bold">
                  {number ? `Game ${number}` : "Not recorded"}
                </span>
                <span>{courtLabel(match.courtNumber)}</span>
                {match.startedAt && (
                  <span className="font-mono">
                    {formatClock(match.startedAt)}
                    {match.endedAt ? ` – ${formatClock(match.endedAt)}` : ""}
                  </span>
                )}
                {length !== null && <span className="font-mono">{length} min</span>}
              </div>
              <p
                className={cn(
                  "mt-1 text-[14px] leading-snug",
                  record === "unrecorded" && "text-muted line-through decoration-1",
                )}
              >
                <span className="font-semibold">{match.team1.map((row) => row.nickname).join(" & ")}</span>
                <span className="text-muted mx-1.5 text-[12px]">vs</span>
                <span className="font-semibold">{match.team2.map((row) => row.nickname).join(" & ")}</span>
              </p>

              {isEditing ? (
                <div className="mt-3 space-y-2">
                  {[0, 1].map((team) => (
                    <div key={team} className="flex items-center gap-2">
                      <span className="text-muted w-14 shrink-0 text-[11px] font-bold uppercase">
                        Team {team === 0 ? "A" : "B"}
                      </span>
                      {[0, 1].map((seat) => {
                        const index = team * 2 + seat;
                        return (
                          <Select
                            key={seat}
                            value={editing.slots[index]}
                            aria-label={`Team ${team === 0 ? "A" : "B"}, player ${seat + 1}`}
                            onChange={(event) =>
                              setEditing({
                                id: match.id,
                                slots: editing.slots.map((id, at) =>
                                  at === index ? event.target.value : id,
                                ),
                              })
                            }
                            className="h-10 min-w-0 flex-1 text-[13px]"
                          >
                            {[
                              ...[...match.team1, ...match.team2].filter(
                                (row) => !choices.some((player) => player.playerId === row.playerId),
                              ),
                              ...choices,
                            ].map((player) => (
                              <option
                                key={player.playerId}
                                value={player.playerId}
                                disabled={
                                  editing.slots.includes(player.playerId) &&
                                  editing.slots[index] !== player.playerId
                                }
                              >
                                {player.nickname} ({player.levelLabel})
                              </option>
                            ))}
                          </Select>
                        );
                      })}
                    </div>
                  ))}
                  <p className="text-muted text-[11px]">
                    {record === "counted"
                      ? "Whoever comes off loses this game (and its fee); whoever goes on gains it."
                      : "This game isn't counted, so nobody's game count changes."}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      loading={pending}
                      disabled={new Set(editing.slots).size !== 4 || editing.slots.join() === lineup.join()}
                      onClick={() => {
                        onEditPlayers(match.id, editing.slots.slice(0, 2), editing.slots.slice(2));
                        setEditing(null);
                      }}
                    >
                      Save players
                    </Button>
                  </div>
                </div>
              ) : (
                !locked && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <div
                      role="radiogroup"
                      aria-label="How this game counts"
                      className="border-line bg-paper inline-flex rounded-full border p-0.5"
                    >
                      {RECORDS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={record === option.value}
                          title={option.hint}
                          disabled={pending}
                          onClick={() => record !== option.value && onSetRecord(match.id, option.value)}
                          className={cn(
                            "press inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-[12px] font-semibold transition disabled:opacity-50",
                            record === option.value
                              ? option.value === "counted"
                                ? "bg-forest text-cream"
                                : option.value === "free"
                                  ? "bg-violet-100 text-violet-900"
                                  : "bg-coral-soft text-coral"
                              : "text-muted hover:text-ink",
                          )}
                        >
                          {option.icon} {option.label}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="paper"
                      size="sm"
                      className="ml-auto"
                      disabled={pending}
                      onClick={() => setEditing({ id: match.id, slots: lineup })}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit players
                    </Button>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}
