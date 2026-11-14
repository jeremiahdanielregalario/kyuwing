"use client";

import * as React from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Minus,
  Pencil,
  Play,
  Plus,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { formatTime12, planWindow } from "@/lib/court-plan";
import { courtNamesText, courtSetupProblem, resizedCourtNames, type CourtSetup } from "@/lib/court-setup";
import type { BoardGameDay, BoardPlayer } from "@/lib/board-types";
import {
  courtName,
  formatGameDate,
  formatTimeRange,
  parseCourtNumbers,
  type CourtSlot,
} from "@/lib/datetime";
import { isUnrated } from "@/lib/levels";
import { courtCost, courtHours, effectiveCourtRate, formatPeso, GAMEDAY_TYPE_LABELS } from "@/lib/fees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

/**
 * The review before a game day goes live: every detail of the game day and who signed up, then
 * per block how many courts were reserved and what the venue calls them. Opens on its own at the
 * start time (see the board), or from Start game day. Mount it only while open, so it starts from
 * the saved plan.
 */
export function StartGameDayDialog({
  plan,
  gameDay,
  players,
  pending,
  onClose,
  onEditDetails,
  onEditPlayers,
  onStart,
}: {
  plan: CourtSlot[];
  gameDay: BoardGameDay;
  players: BoardPlayer[];
  pending: boolean;
  onClose: () => void;
  /** Leave the review to change the name, date, venue, type, times, rate or people (Settings). */
  onEditDetails: () => void;
  /** Leave the review to manage sign-ups and check-ins. */
  onEditPlayers: () => void;
  onStart: (setup: CourtSetup[]) => void;
}) {
  const [rows, setRows] = React.useState<CourtSetup[]>(() =>
    plan.map((slot) => ({ id: slot.id, courts: slot.courts, names: courtNamesText(slot) })),
  );
  const problems = rows.map((row) => courtSetupProblem(row.courts, row.names));
  const blocked = problems.some(Boolean);

  const update = (index: number, patch: Partial<CourtSetup>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)));

  // Typing names sets the count; the stepper changes the count and extends a run of numbers.
  const typeNames = (index: number, names: string) => {
    const count = parseCourtNumbers(names).length;
    update(index, count > 0 ? { names, courts: Math.min(20, count) } : { names });
  };
  const step = (index: number, delta: number) => {
    const row = rows[index];
    const courts = Math.min(20, Math.max(1, row.courts + delta));
    update(index, { courts, names: resizedCourtNames(row.names, courts) ?? row.names });
  };

  const venue = gameDay.venue.shortName || gameDay.venue.name;
  const span = planWindow(plan);
  const rate = effectiveCourtRate(gameDay.courtRatePerHour, gameDay.venue.shortName);
  const rent = courtCost(plan, rate);
  const checkedIn = players.filter((player) => player.status !== "EXPECTED");
  const expected = players.filter((player) => player.status === "EXPECTED");
  const unrated = players.filter((player) => isUnrated(player.level)).length;

  const copyToAll = (index: number) =>
    setRows((current) =>
      current.map((row) => ({ ...row, courts: current[index].courts, names: current[index].names })),
    );

  return (
    <Modal
      open
      onClose={onClose}
      title="Review the game day before you start"
      description="Check every detail below. Fix the courts right here; use Edit for anything else."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={() => onStart(rows)} loading={pending} disabled={blocked}>
            <Play className="h-4 w-4" /> Everything&apos;s right, start
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <section className="border-line bg-paper rounded-2xl border p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display pt-1.5 text-[15px] leading-tight font-bold">{gameDay.name}</p>
            <EditButton onClick={onEditDetails} label="Edit details" />
          </div>
          <dl className="mt-2.5 grid gap-x-4 gap-y-2 text-[12px] sm:grid-cols-2">
            <ReviewRow icon={CalendarDays} label="Date">
              {formatGameDate(gameDay.date, { weekday: true })}
            </ReviewRow>
            <ReviewRow icon={Clock3} label="Game time">
              {span ? formatTimeRange(span.start, span.end) : "No court blocks"}
            </ReviewRow>
            <ReviewRow icon={MapPin} label="Venue">
              {gameDay.venue.name}
              {gameDay.venue.shortName && gameDay.venue.shortName !== gameDay.venue.name
                ? ` (${gameDay.venue.shortName})`
                : ""}
            </ReviewRow>
            <ReviewRow icon={CalendarDays} label="Type">
              {GAMEDAY_TYPE_LABELS[gameDay.type]}
            </ReviewRow>
            <ReviewRow icon={Wallet} label="Court rent">
              {rate > 0
                ? `${courtHours(plan)} court-hours × ${formatPeso(rate)} = ${formatPeso(rent)}`
                : "No court rate set"}
            </ReviewRow>
            <ReviewRow icon={Users} label="Queue master · Finance">
              {gameDay.queueMasterName || "Not set"} · {gameDay.financeMemberName || "Not set"}
            </ReviewRow>
          </dl>
        </section>

        <section className="border-line bg-paper rounded-2xl border p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="pt-1">
              <p className="text-[13px] font-semibold">Players</p>
              <p className="text-muted text-[11px]">
                {players.length} signed up · {checkedIn.length} checked in · {expected.length} not here yet
              </p>
            </div>
            <EditButton onClick={onEditPlayers} label="Edit sign-ups" />
          </div>
          {players.length === 0 ? (
            <p className="text-muted mt-1.5 text-[12px]">
              Nobody has signed up yet. You can still start and check players in as they arrive.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <PlayerChips label="Checked in" players={checkedIn} tone="in" />
              <PlayerChips label="Not here yet" players={expected} tone="out" />
            </div>
          )}
          {unrated > 0 && (
            <p className="text-coral mt-2 flex items-center gap-1.5 text-[11px] font-semibold">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {unrated}{" "}
              {unrated === 1 ? "player has" : "players have"} no level yet.
            </p>
          )}
        </section>

        <p className="text-muted px-1 pt-1 text-[10px] font-bold tracking-[0.14em] uppercase">
          Courts at {venue}
        </p>
        {plan.map((slot, index) => {
          const row = rows[index];
          const problem = problems[index];
          const labels = parseCourtNumbers(row.names);
          const changed = row.courts !== slot.courts;
          return (
            <section
              key={slot.id}
              data-trim-id="board.start-courts"
              className={cn(
                "rounded-2xl border p-3.5",
                problem ? "border-coral/40 bg-coral-soft/40" : "border-line bg-cream/40",
              )}
            >
              {plan.length > 1 && (
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold">
                  <Clock3 className="text-muted h-3.5 w-3.5" /> {slot.label} · {formatTime12(slot.start)} –{" "}
                  {formatTime12(slot.end)}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold">Courts reserved</p>
                  <p className="text-muted text-[11px]">
                    {changed
                      ? `Was ${slot.courts}. Saving changes the plan.`
                      : "Is this how many the venue gave you?"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => step(index, -1)}
                    disabled={row.courts <= 1}
                    className="press border-line bg-paper grid h-11 w-11 place-items-center rounded-full border disabled:opacity-40"
                    aria-label={`One court fewer${plan.length > 1 ? ` in ${slot.label}` : ""}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span
                    className="font-display w-10 text-center text-2xl font-extrabold tabular-nums"
                    aria-live="polite"
                  >
                    {row.courts}
                  </span>
                  <button
                    type="button"
                    onClick={() => step(index, 1)}
                    disabled={row.courts >= 20}
                    className="press border-line bg-paper grid h-11 w-11 place-items-center rounded-full border disabled:opacity-40"
                    aria-label={`One more court${plan.length > 1 ? ` in ${slot.label}` : ""}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <label className="mt-3 block">
                <span className="text-muted mb-1 block text-[10px] font-bold tracking-[0.12em] uppercase">
                  Court names
                </span>
                <Input
                  value={row.names}
                  onChange={(event) => typeNames(index, event.target.value)}
                  placeholder="e.g. 1, 2, 3 or 5-8"
                  className="h-11 text-[14px]"
                  inputMode="text"
                  aria-invalid={Boolean(problem)}
                />
              </label>
              {problem ? (
                <p className="text-coral mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> {problem}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {labels.map((_, position) => (
                    <span
                      key={position}
                      className="border-line bg-paper rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                    >
                      {courtName({ ...slot, courts: labels.length, courtLabels: labels }, position + 1)}
                    </span>
                  ))}
                </div>
              )}
              {plan.length > 1 &&
                index === 0 &&
                !problem &&
                rows.some((other) => other.names !== row.names || other.courts !== row.courts) && (
                  <button
                    type="button"
                    onClick={() => copyToAll(index)}
                    className="text-forest mt-2 min-h-9 text-[12px] font-semibold hover:underline"
                  >
                    Use these courts in every block
                  </button>
                )}
            </section>
          );
        })}
        <p className="text-muted text-[11px] leading-relaxed">
          Use the numbers painted on the venue&apos;s courts, separated by commas (or a range like 5-8). You
          can still rename a court or add one from the board later.
        </p>
      </div>
    </Modal>
  );
}

function ReviewRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="text-muted mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <dt className="text-muted text-[10px] font-bold tracking-[0.12em] uppercase">{label}</dt>
        <dd className="text-ink font-semibold break-words">{children}</dd>
      </div>
    </div>
  );
}

function PlayerChips({
  label,
  players,
  tone,
}: {
  label: string;
  players: BoardPlayer[];
  tone: "in" | "out";
}) {
  if (players.length === 0) return null;
  return (
    <div>
      <p className="text-muted mb-1 text-[10px] font-bold tracking-[0.12em] uppercase">
        {label} · {players.length}
      </p>
      <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
        {players.map((player) => (
          <span
            key={player.sessionPlayerId}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              tone === "in" ? "border-forest/30 bg-cream/60 text-ink" : "border-line text-muted bg-white",
            )}
          >
            {player.nickname}
            <span className="ml-1 opacity-60">{player.levelLabel}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press border-line text-forest hover:bg-cream-deep inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 text-[12px] font-semibold"
    >
      <Pencil className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
