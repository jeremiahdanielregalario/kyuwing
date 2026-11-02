"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Crosshair,
  Download,
  Flag,
  HeartHandshake,
  LayoutGrid,
  Link2,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  Star,
  Trophy,
  UserCheck,
  UserRoundPlus,
  Users,
  Wand2,
  XCircle,
  Zap,
} from "lucide-react";
import {
  cancelMatch,
  checkInPlayer,
  clearSuggestedMatches,
  completeMatch,
  generateMatches,
  markPlayerDone,
  requeuePlayer,
  setGameDayStatus,
  startAllSuggested,
  startMatch,
  togglePriority,
  updateMatchCourt,
  updateMatchPlayers,
  addWalkIn,
} from "@/lib/actions/gamedays";
import type { BoardData, BoardMatch, BoardPlayer } from "@/lib/board-types";
import { CATEGORY_SHORT, GAMEDAY_TYPE_LABELS } from "@/lib/fees";
import { LEVELS, levelValue } from "@/lib/levels";
import { formatClock, formatDuration, formatGameDate } from "@/lib/datetime";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Modal } from "@/components/ui/modal";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

type AnyResult = { ok: true; message?: string } | { ok: false; error: string };
type QueueTab = "waiting" | "playing" | "expected" | "done";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not refresh the board");
  return response.json() as Promise<BoardData>;
};

function useNow() {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function waitSeconds(queuedAt: string | null, now: number) {
  if (!queuedAt) return 0;
  return Math.max(0, Math.floor((now - Date.parse(queuedAt)) / 1000));
}

function teamValue(team: { level: string }[]) {
  return team.reduce((sum, player) => sum + levelValue(player.level), 0);
}

export function QueueBoard({ initialData }: { initialData: BoardData }) {
  const [slotIndex, setSlotIndex] = React.useState(initialData.activeSlotIndex);
  const key = `/api/gamedays/${initialData.gameDay.id}/board?slot=${slotIndex}`;
  const {
    data: freshData,
    mutate,
    isValidating,
  } = useSWR<BoardData>(key, fetcher, {
    fallbackData: initialData,
    refreshInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  const data = freshData ?? initialData;
  const now = useNow();
  const [pending, startTransition] = React.useTransition();

  const [tab, setTab] = React.useState<QueueTab>("waiting");
  const [query, setQuery] = React.useState("");
  const [checkOpen, setCheckOpen] = React.useState(false);
  const [checkQuery, setCheckQuery] = React.useState("");
  const [walkOpen, setWalkOpen] = React.useState(false);
  const [walk, setWalk] = React.useState({ nickname: "", level: "C", category: "ACTIVE" });
  const [scoreMatch, setScoreMatch] = React.useState<BoardMatch | null>(null);
  const [score1, setScore1] = React.useState("");
  const [score2, setScore2] = React.useState("");
  const [editMatch, setEditMatch] = React.useState<BoardMatch | null>(null);
  const [editCourt, setEditCourt] = React.useState(1);
  const [editTeam1, setEditTeam1] = React.useState<string[]>([]);
  const [editTeam2, setEditTeam2] = React.useState<string[]>([]);

  const act = (fn: () => Promise<AnyResult>, onSuccess?: () => void) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        onSuccess?.();
        await mutate();
      } else {
        toast.error(result.error);
      }
    });
  };

  const plan = data.gameDay.courtPlan;
  const slot = plan[data.activeSlotIndex] ?? plan[0];
  const suggested = data.activeMatches.filter((match) => match.status === "SUGGESTED");
  const live = data.activeMatches.filter((match) => match.status === "LIVE");
  const courtCount = Math.max(
    data.stats.courtsTotal,
    ...data.activeMatches.map((match) => match.courtNumber),
    1,
  );
  const courtNumbers = Array.from({ length: courtCount }, (_, index) => index + 1);
  const isDraft = data.gameDay.status === "DRAFT";
  const isCompleted = data.gameDay.status === "COMPLETED";

  const sortedQueue = React.useMemo(() => {
    const statusOrder: Record<string, number> = { WAITING: 0, PLAYING: 1, EXPECTED: 2, DONE: 3 };
    return [...data.players].sort((a, b) => {
      if (Boolean(a.priority) !== Boolean(b.priority)) return a.priority ? -1 : 1;
      if (statusOrder[a.status] !== statusOrder[b.status])
        return statusOrder[a.status] - statusOrder[b.status];
      const aq = a.queuedAt ? Date.parse(a.queuedAt) : Number.MAX_SAFE_INTEGER;
      const bq = b.queuedAt ? Date.parse(b.queuedAt) : Number.MAX_SAFE_INTEGER;
      if (aq !== bq) return aq - bq;
      return a.nickname.localeCompare(b.nickname);
    });
  }, [data.players]);

  const tabCounts: Record<QueueTab, number> = {
    waiting: data.players.filter((player) => player.status === "WAITING").length,
    playing: data.players.filter((player) => player.status === "PLAYING").length,
    expected: data.players.filter((player) => player.status === "EXPECTED").length,
    done: data.players.filter((player) => player.status === "DONE").length,
  };

  const visible = sortedQueue
    .filter((player) => player.status === tab.toUpperCase())
    .filter((player) => player.nickname.toLowerCase().includes(query.toLowerCase()));

  const expected = data.players
    .filter((player) => player.status === "EXPECTED")
    .filter((player) => player.nickname.toLowerCase().includes(checkQuery.toLowerCase()))
    .sort((a, b) => a.nickname.localeCompare(b.nickname));

  const openScore = (match: BoardMatch) => {
    setScoreMatch(match);
    setScore1("");
    setScore2("");
  };

  const openEdit = (match: BoardMatch) => {
    setEditMatch(match);
    setEditCourt(match.courtNumber);
    setEditTeam1(match.team1.map((player) => player.playerId));
    setEditTeam2(match.team2.map((player) => player.playerId));
  };

  const submitScore = () => {
    if (!scoreMatch) return;
    const first = Number(score1);
    const second = Number(score2);
    if (!Number.isFinite(first) || !Number.isFinite(second) || score1 === "" || score2 === "") {
      toast.error("Enter both final scores.");
      return;
    }
    if (first === second) {
      toast.error("A badminton game cannot end in a tie.");
      return;
    }
    act(
      () => completeMatch(scoreMatch.id, first, second),
      () => setScoreMatch(null),
    );
  };

  const submitEdit = () => {
    if (!editMatch) return;
    const all = [...editTeam1, ...editTeam2];
    if (new Set(all).size !== 4) {
      toast.error("Pick four different players.");
      return;
    }
    startTransition(async () => {
      if (editCourt !== editMatch.courtNumber) {
        const moved = await updateMatchCourt(editMatch.id, editCourt);
        if (!moved.ok) {
          toast.error(moved.error);
          return;
        }
      }
      const result = await updateMatchPlayers(editMatch.id, editTeam1, editTeam2);
      if (result.ok) {
        toast.success(result.message ?? "Line-up updated.");
        setEditMatch(null);
        await mutate();
      } else {
        toast.error(result.error);
      }
    });
  };

  const submitWalkIn = () => {
    if (!walk.nickname.trim()) {
      toast.error("Enter the player's nickname.");
      return;
    }
    act(
      () => addWalkIn(data.gameDay.id, walk),
      () => {
        setWalkOpen(false);
        setWalk({ nickname: "", level: "C", category: "ACTIVE" });
      },
    );
  };

  const editOptions = React.useMemo(() => {
    const current = new Set(
      [...(editMatch?.team1 ?? []), ...(editMatch?.team2 ?? [])].map((player) => player.playerId),
    );
    const busyElsewhere = new Set(
      data.activeMatches
        .filter((match) => match.id !== editMatch?.id)
        .flatMap((match) => [...match.team1, ...match.team2].map((player) => player.playerId)),
    );
    return data.players
      .filter(
        (player) =>
          (player.status === "WAITING" || current.has(player.playerId)) &&
          !busyElsewhere.has(player.playerId),
      )
      .sort((a, b) => levelValue(b.level) - levelValue(a.level));
  }, [data.activeMatches, data.players, editMatch]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-muted flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase">
            <span>{data.gameDay.venue.shortName}</span>
            <span className="bg-muted/40 h-1 w-1 rounded-full" />
            <span>{formatGameDate(data.gameDay.date, { weekday: true })}</span>
            <span className="bg-muted/40 h-1 w-1 rounded-full" />
            <span>{GAMEDAY_TYPE_LABELS[data.gameDay.type]}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] tracking-[0.12em]",
                data.gameDay.status === "LIVE" && "bg-emerald-100 text-emerald-800",
                data.gameDay.status === "DRAFT" && "bg-amber-100 text-amber-900",
                data.gameDay.status === "COMPLETED" && "bg-cream-deep text-muted",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  data.gameDay.status === "LIVE"
                    ? "animate-pulse-soft bg-emerald-500"
                    : "bg-current opacity-50",
                )}
              />
              {data.gameDay.status}
            </span>
          </div>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {data.gameDay.name}
          </h1>
          <p className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {slot ? `${slot.start}–${slot.end} · ${slot.courts} courts` : "No court block set"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              {isValidating ? "Syncing board…" : "Live on all devices"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/app/gamedays/${data.gameDay.id}/reports`} className="hidden sm:inline-flex">
            <Button variant="paper" size="sm">
              <Download className="h-3.5 w-3.5" /> Reports
            </Button>
          </Link>
          <Link href={`/app/gamedays/${data.gameDay.id}/settings`}>
            <Button variant="paper" size="sm">
              <Settings2 className="h-3.5 w-3.5" /> Settings
            </Button>
          </Link>
        </div>
      </div>

      {isDraft && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700" />
            <div>
              <p className="text-[13px] font-semibold text-amber-900">This game day is still a draft.</p>
              <p className="text-[11px] text-amber-800/70">
                Start it when the first players arrive. You can still edit settings before or during play.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="accent"
            onClick={() => act(() => setGameDayStatus(data.gameDay.id, "LIVE"))}
            loading={pending}
          >
            <Play className="h-3.5 w-3.5" /> Start game day
          </Button>
        </div>
      )}

      {isCompleted && (
        <div className="border-line bg-cream-deep/70 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
          <div className="flex items-start gap-2.5">
            <CircleCheck className="text-forest mt-0.5 h-4 w-4" />
            <div>
              <p className="text-[13px] font-semibold">Game day closed.</p>
              <p className="text-muted text-[11px]">
                The final ledger and match history are ready to export.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/app/gamedays/${data.gameDay.id}/reports`}>
              <Button size="sm" variant="primary">
                Open reports
              </Button>
            </Link>
            <Button
              size="sm"
              variant="paper"
              onClick={() => act(() => setGameDayStatus(data.gameDay.id, "LIVE"))}
            >
              Reopen
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Waiting now"
          value={data.stats.waiting}
          hint={`${data.stats.expected} still expected · avg ${data.stats.averageWaitMinutes}m`}
          icon={<Users className="h-4 w-4" />}
          tone="forest"
        />
        <Stat
          label="On court"
          value={data.stats.playing}
          hint={`${live.length} live · ${suggested.length} suggested`}
          icon={<Activity className="h-4 w-4" />}
        />
        <Stat
          label="Open courts"
          value={`${data.stats.courtsOpen}/${data.stats.courtsTotal}`}
          hint={slot ? `${slot.start}–${slot.end} block` : "Set a court block"}
          icon={<LayoutGrid className="h-4 w-4" />}
          tone="lime"
        />
        <Stat
          label="Games today"
          value={data.stats.gamesCompleted}
          hint={`${data.stats.totalGamesPlayed} player-games logged`}
          icon={<Trophy className="h-4 w-4" />}
        />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted mr-1 ml-1 text-[10px] font-bold tracking-[0.16em] uppercase">
            Court plan
          </span>
          {plan.length === 0 && (
            <Link
              href={`/app/gamedays/${data.gameDay.id}/settings`}
              className="text-coral text-[12px] font-semibold underline"
            >
              Add a court block
            </Link>
          )}
          {plan.map((row, index) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSlotIndex(index)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                data.activeSlotIndex === index
                  ? "border-forest bg-forest text-cream"
                  : "border-line bg-paper text-ink-soft hover:border-forest/40",
              )}
            >
              <span className="font-mono">
                {row.start}–{row.end}
              </span>
              <span className="ml-1.5 opacity-60">· {row.courts}c</span>
              {row.label && <span className="ml-1.5 hidden opacity-60 sm:inline">{row.label}</span>}
            </button>
          ))}
          <span className="text-muted ml-auto inline-flex items-center gap-1.5 text-[11px]">
            <Dot tone="lime" /> {formatClock(new Date(now))} Manila
          </span>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => act(() => generateMatches(data.gameDay.id, slotIndex))}
          disabled={pending || isCompleted}
          className="flex-1 sm:flex-none"
        >
          <Wand2 className="h-4 w-4" />
          Auto-pair next games
        </Button>
        <Button variant="accent" onClick={() => setCheckOpen(true)} disabled={isCompleted}>
          <UserCheck className="h-4 w-4" />
          Check in
        </Button>
        <Button variant="paper" onClick={() => setWalkOpen(true)} disabled={isCompleted}>
          <UserRoundPlus className="h-4 w-4" />
          Walk-in
        </Button>
        {suggested.length > 0 && (
          <>
            <Button
              variant="primary"
              onClick={() => act(() => startAllSuggested(data.gameDay.id))}
              loading={pending}
            >
              <Play className="h-4 w-4" />
              Start all ({suggested.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm("Clear all suggested matches? Players stay in the queue.")) {
                  act(() => clearSuggestedMatches(data.gameDay.id));
                }
              }}
            >
              Clear suggestions
            </Button>
          </>
        )}
        {isValidating && <span className="text-muted ml-auto hidden text-[11px] sm:inline">Syncing…</span>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold tracking-tight">
              Courts
              <span className="text-muted ml-2 font-sans text-[11px] font-normal">
                {slot ? `${slot.start}–${slot.end} · ${data.stats.courtsTotal} courts` : ""}
              </span>
            </h2>
            <span className="text-muted inline-flex items-center gap-1.5 text-[11px]">
              <Dot tone={live.length ? "green" : "muted"} /> {live.length} live
            </span>
          </div>

          {data.stats.courtsTotal === 0 ? (
            <EmptyState
              icon={<LayoutGrid className="h-5 w-5" />}
              title="No courts in this block"
              description="Add a time block and court count in Settings so the engine knows where games can go."
              action={
                <Link href={`/app/gamedays/${data.gameDay.id}/settings`}>
                  <Button size="sm" variant="primary">
                    Open settings
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courtNumbers.map((court) => {
                const match = data.activeMatches.find((item) => item.courtNumber === court);
                return (
                  <CourtCard
                    key={court}
                    court={court}
                    match={match}
                    now={now}
                    pending={pending}
                    isCompleted={isCompleted}
                    onPair={() => act(() => generateMatches(data.gameDay.id, slotIndex, 1))}
                    onStart={(id) => act(() => startMatch(id))}
                    onFinish={openScore}
                    onEdit={openEdit}
                    onCancel={(id) => {
                      if (window.confirm("Cancel this match? Players will stay in the queue.")) {
                        act(() => cancelMatch(id));
                      }
                    }}
                  />
                );
              })}
            </div>
          )}

          {data.recentMatches.length > 0 && (
            <div className="border-line bg-paper/70 rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-muted text-[11px] font-bold tracking-[0.16em] uppercase">
                  Recently finished
                </h3>
                <Link
                  href={`/app/gamedays/${data.gameDay.id}/reports`}
                  className="text-forest text-[11px] font-semibold hover:underline"
                >
                  All matches
                </Link>
              </div>
              <div className="space-y-2">
                {data.recentMatches.slice(0, 4).map((match) => (
                  <div
                    key={match.id}
                    className="border-line/60 bg-cream/30 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 text-[11px]"
                  >
                    <span className="text-muted font-mono font-bold">C{match.courtNumber}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {match.team1.map((player) => player.nickname).join(" & ")}
                      <span className="text-muted mx-1.5">vs</span>
                      {match.team2.map((player) => player.nickname).join(" & ")}
                    </span>
                    <span className="font-mono font-bold">
                      <span className={match.score1! > match.score2! ? "text-forest" : "text-muted"}>
                        {match.score1}
                      </span>
                      <span className="text-muted mx-1">–</span>
                      <span className={match.score2! > match.score1! ? "text-forest" : "text-muted"}>
                        {match.score2}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Card className="h-fit xl:sticky xl:top-6">
          <div className="border-line/80 border-b px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold tracking-tight">The queue</h2>
              <span className="bg-cream-deep text-ink-soft inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10px] font-bold">
                <Users className="h-3 w-3" /> {data.players.length}
              </span>
            </div>
            <div className="hide-scrollbar mt-3 flex gap-1 overflow-x-auto">
              {(
                [
                  ["waiting", "Waiting"],
                  ["playing", "On court"],
                  ["expected", "Expected"],
                  ["done", "Done"],
                ] as Array<[QueueTab, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition",
                    tab === value ? "bg-forest text-cream" : "text-muted hover:bg-cream-deep",
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "ml-1 font-mono text-[9px]",
                      tab === value ? "text-lime/80" : "text-muted/70",
                    )}
                  >
                    {tabCounts[value]}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative mt-3">
              <Search className="text-muted pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a player…"
                className="h-9 pl-8 text-[12px]"
              />
            </div>
          </div>

          <div className="max-h-[min(62vh,640px)] overflow-y-auto px-2 py-2">
            {visible.length === 0 ? (
              <div className="text-muted px-3 py-10 text-center text-[12px]">
                {query
                  ? "No player matches that search."
                  : `No players ${tab === "waiting" ? "waiting" : tab}.`}
              </div>
            ) : (
              <div className="space-y-1">
                {visible.map((player) => (
                  <QueueRow
                    key={player.sessionPlayerId}
                    player={player}
                    now={now}
                    pending={pending}
                    onCheckIn={() => act(() => checkInPlayer(player.sessionPlayerId))}
                    onDone={() => {
                      if (window.confirm(`Mark ${player.nickname} done for the day?`)) {
                        act(() => markPlayerDone(player.sessionPlayerId));
                      }
                    }}
                    onRequeue={() => act(() => requeuePlayer(player.sessionPlayerId))}
                    onPriority={() => act(() => togglePriority(player.sessionPlayerId))}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-line/80 flex items-center justify-between border-t px-4 py-3">
            <span className="text-muted text-[11px]">
              Longest wait{" "}
              <span className="text-forest font-mono font-bold">{data.stats.longestWaitMinutes}m</span>
            </span>
            <Link
              href={`/app/gamedays/${data.gameDay.id}/signups`}
              className="text-forest inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
            >
              Manage sign-ups <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Check-in modal */}
      <Modal
        open={checkOpen}
        onClose={() => setCheckOpen(false)}
        title="Check in arrivals"
        description="Only checked-in players enter the pairing queue."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCheckOpen(false)}>
              Done
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                setCheckOpen(false);
                setWalkOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Walk-in
            </Button>
          </>
        }
      >
        <div className="relative mb-3">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={checkQuery}
            onChange={(event) => setCheckQuery(event.target.value)}
            placeholder="Search the sign-up list…"
            className="pl-8"
            autoFocus
          />
        </div>
        {expected.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Everyone is checked in"
            description="No expected players left. Add a walk-in if someone new arrives."
          />
        ) : (
          <div className="space-y-1">
            {expected.map((player) => (
              <div
                key={player.sessionPlayerId}
                className="border-line/70 flex items-center gap-3 rounded-xl border px-3 py-2.5"
              >
                <Avatar name={player.nickname} level={player.levelLabel} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{player.nickname}</p>
                  <p className="text-muted text-[10px]">
                    {CATEGORY_SHORT[player.category]} · {player.gamesPlayed} games
                  </p>
                </div>
                <LevelBadge level={player.level} />
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() => act(() => checkInPlayer(player.sessionPlayerId))}
                  loading={pending}
                >
                  Check in
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Walk-in modal */}
      <Modal
        open={walkOpen}
        onClose={() => setWalkOpen(false)}
        title="Add a walk-in"
        description="Adds them to the player database if they are new, then puts them straight in the queue."
        footer={
          <>
            <Button variant="ghost" onClick={() => setWalkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitWalkIn} loading={pending} disabled={!walk.nickname.trim()}>
              <UserRoundPlus className="h-4 w-4" /> Add to queue
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nickname">
            <Input
              value={walk.nickname}
              onChange={(event) => setWalk({ ...walk, nickname: event.target.value })}
              placeholder="e.g. Jose"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Level">
              <Select
                value={walk.level}
                onChange={(event) => setWalk({ ...walk, level: event.target.value })}
              >
                {LEVELS.map((level) => (
                  <option key={level.key} value={level.key}>
                    {level.label} · {level.bracket}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Player type">
              <Select
                value={walk.category}
                onChange={(event) => setWalk({ ...walk, category: event.target.value })}
              >
                <option value="ACTIVE">Active member</option>
                <option value="ALUMNI">Inactive / Alumni</option>
                <option value="APPLICANT">Applicant</option>
              </Select>
            </Field>
          </div>
          <p className="bg-cream-deep/60 text-muted rounded-xl px-3 py-2 text-[11px]">
            If the nickname already exists, their saved level and player type will be used.
          </p>
        </div>
      </Modal>

      {/* Score modal */}
      <Modal
        open={Boolean(scoreMatch)}
        onClose={() => setScoreMatch(null)}
        title={`Finish Court ${scoreMatch?.courtNumber ?? ""}`}
        description="Enter the final score. Both players return to the queue automatically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setScoreMatch(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={submitScore}
              loading={pending}
              disabled={score1 === "" || score2 === ""}
            >
              <Flag className="h-4 w-4" /> Finish game
            </Button>
          </>
        }
      >
        {scoreMatch && (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
              <ScorePad
                label="Team A"
                team={scoreMatch.team1}
                value={score1}
                onChange={setScore1}
                target={data.gameDay.targetScore}
              />
              <div className="grid place-items-center px-1">
                <span className="border-line bg-cream text-muted rounded-full border px-2 py-1 font-mono text-[10px] font-bold">
                  VS
                </span>
              </div>
              <ScorePad
                label="Team B"
                team={scoreMatch.team2}
                value={score2}
                onChange={setScore2}
                target={data.gameDay.targetScore}
              />
            </div>
            <p className="text-muted text-center text-[11px]">
              First to {data.gameDay.targetScore}. Court changes after the game — update the next match when
              you are ready.
            </p>
            {Number(score1) === Number(score2) && score1 !== "" && score2 !== "" && (
              <p className="bg-coral-soft rounded-xl px-3 py-2 text-center text-[12px] font-semibold text-[#a8331a]">
                Scores are tied. A badminton game needs a winner.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Edit match modal */}
      <Modal
        open={Boolean(editMatch)}
        onClose={() => setEditMatch(null)}
        title={`Edit Court ${editMatch?.courtNumber ?? ""}`}
        description="Swap players or move the match. Keep the pairing fair."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditMatch(null)}>
              Cancel
            </Button>
            <Button onClick={submitEdit} loading={pending}>
              <Check className="h-4 w-4" /> Save line-up
            </Button>
          </>
        }
      >
        {editMatch && (
          <div className="space-y-5">
            <Field label="Court">
              <Select value={editCourt} onChange={(event) => setEditCourt(Number(event.target.value))}>
                {Array.from(
                  { length: Math.max(1, data.stats.courtsTotal || 1) },
                  (_, index) => index + 1,
                ).map((court) => (
                  <option key={court} value={court}>
                    Court {court}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Team A", value: editTeam1, set: setEditTeam1, tone: "forest" as const },
                { label: "Team B", value: editTeam2, set: setEditTeam2, tone: "paper" as const },
              ].map((team) => (
                <div
                  key={team.label}
                  className={cn(
                    "rounded-2xl border p-3",
                    team.tone === "forest" ? "border-forest/20 bg-forest/[0.03]" : "border-line bg-cream/30",
                  )}
                >
                  <p className="text-muted mb-2 text-[10px] font-bold tracking-[0.14em] uppercase">
                    {team.label}
                  </p>
                  <div className="space-y-2">
                    {[0, 1].map((slotIndexInTeam) => (
                      <Select
                        key={slotIndexInTeam}
                        value={team.value[slotIndexInTeam] ?? ""}
                        onChange={(event) => {
                          const next = [...team.value];
                          next[slotIndexInTeam] = event.target.value;
                          team.set(next);
                        }}
                      >
                        <option value="">Pick a player…</option>
                        {editOptions.map((player) => (
                          <option key={player.playerId} value={player.playerId}>
                            {player.nickname} · {player.levelLabel}{" "}
                            {player.status === "PLAYING" ? "(on court)" : ""}
                          </option>
                        ))}
                      </Select>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="bg-cream-deep/60 text-muted rounded-xl px-3 py-2 text-[11px]">
              Only waiting players and the current four are listed. Players already on another court are
              hidden to avoid double-booking.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CourtCard({
  court,
  match,
  now,
  pending,
  isCompleted,
  onPair,
  onStart,
  onFinish,
  onEdit,
  onCancel,
}: {
  court: number;
  match?: BoardMatch;
  now: number;
  pending: boolean;
  isCompleted: boolean;
  onPair: () => void;
  onStart: (id: string) => void;
  onFinish: (match: BoardMatch) => void;
  onEdit: (match: BoardMatch) => void;
  onCancel: (id: string) => void;
}) {
  if (!match) {
    return (
      <div
        className={cn(
          "border-line-strong/60 bg-paper/50 flex min-h-[190px] flex-col rounded-2xl border-2 border-dashed p-4",
          isCompleted && "opacity-60",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-muted font-mono text-[10px] font-bold tracking-[0.16em] uppercase">
            Court {court}
          </span>
          <Badge tone="outline">Open</Badge>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-5 text-center">
          <span className="bg-cream-deep text-muted grid h-10 w-10 place-items-center rounded-full">
            <LayoutGrid className="h-4 w-4" />
          </span>
          <p className="text-ink-soft mt-2 text-[12px] font-semibold">Court is open</p>
          <p className="text-muted text-[10px]">Pull the next four from the queue.</p>
        </div>
        <Button
          variant="paper"
          size="sm"
          onClick={onPair}
          disabled={pending || isCompleted}
          className="w-full"
        >
          <Wand2 className="h-3.5 w-3.5" /> Pair this court
        </Button>
      </div>
    );
  }

  const live = match.status === "LIVE";
  const elapsed = match.startedAt ? Math.floor((now - Date.parse(match.startedAt)) / 1000) : 0;
  const balance = Math.abs(teamValue(match.team1) - teamValue(match.team2));

  return (
    <div
      className={cn(
        "bg-paper relative flex min-h-[190px] flex-col overflow-hidden rounded-2xl border p-4 transition",
        live ? "border-forest/50 shadow-card" : "border-lime-deep/50 bg-lime/[0.06]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted font-mono text-[10px] font-bold tracking-[0.16em] uppercase">
          Court {court}
        </span>
        <div className="flex items-center gap-1.5">
          {live && (
            <span className="bg-forest text-lime inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[9px] font-bold">
              <span className="animate-pulse-soft bg-lime h-1.5 w-1.5 rounded-full" />
              {formatDuration(elapsed)}
            </span>
          )}
          <Badge tone={live ? "green" : "lime"}>{live ? "Live" : "Suggested"}</Badge>
        </div>
      </div>

      <div className="mt-3 grid flex-1 grid-cols-[1fr_auto_1fr] items-start gap-1.5">
        <MatchTeam team={match.team1} align="left" />
        <div className="grid h-full place-items-center px-0.5">
          <span className="border-line bg-cream text-muted rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold">
            vs
          </span>
        </div>
        <MatchTeam team={match.team2} align="right" />
      </div>

      <div className="border-line/60 mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
        <span className="text-muted inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.1em] uppercase">
          <Zap className="text-lime-deep h-3 w-3" /> {balance === 0 ? "Level teams" : `${balance} level gap`}
        </span>
        <span className="text-muted font-mono text-[9px]">R{match.round}</span>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {live ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onFinish(match)}
            disabled={pending}
            className="flex-1"
          >
            <Flag className="h-3.5 w-3.5" /> Finish
          </Button>
        ) : (
          <Button
            variant="accent"
            size="sm"
            onClick={() => onStart(match.id)}
            disabled={pending || isCompleted}
            className="flex-1"
          >
            <Play className="h-3.5 w-3.5" /> Start
          </Button>
        )}
        <Button
          variant="paper"
          size="icon-sm"
          onClick={() => onEdit(match)}
          disabled={pending}
          aria-label="Edit match"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onCancel(match.id)}
          disabled={pending}
          aria-label="Cancel match"
        >
          <XCircle className="text-coral h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function MatchTeam({ team, align }: { team: BoardMatch["team1"]; align: "left" | "right" }) {
  return (
    <div className={cn("min-w-0 space-y-2", align === "right" && "text-right")}>
      {team.map((player) => (
        <div
          key={player.playerId}
          className={cn("flex items-center gap-1.5", align === "right" && "flex-row-reverse")}
        >
          <Avatar name={player.nickname} size="sm" className="shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-[12px] leading-tight font-semibold">{player.nickname}</p>
            <div className={cn("mt-0.5 flex", align === "right" ? "justify-end" : "justify-start")}>
              <LevelBadge level={player.level} className="min-w-0 px-1 text-[9px]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QueueRow({
  player,
  now,
  pending,
  onCheckIn,
  onDone,
  onRequeue,
  onPriority,
}: {
  player: BoardPlayer;
  now: number;
  pending: boolean;
  onCheckIn: () => void;
  onDone: () => void;
  onRequeue: () => void;
  onPriority: () => void;
}) {
  const wait = waitSeconds(player.queuedAt, now);
  const pairRequest = player.requests.find((request) => request.type === "PAIR_WITH");
  const againstRequest = player.requests.find((request) => request.type === "PLAY_AGAINST");

  return (
    <div
      className={cn(
        "group hover:border-line hover:bg-cream/50 flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 transition",
        player.priority && "border-lime-deep/30 bg-lime/[0.07]",
      )}
    >
      <Avatar name={player.nickname} level={player.levelLabel} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold">{player.nickname}</p>
          {player.priority && <Star className="fill-lime-deep text-lime-deep h-3 w-3" />}
        </div>
        <div className="text-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px]">
          <span>{player.gamesPlayed} games</span>
          {player.permanentPartnerNickname && (
            <span
              className="text-forest inline-flex items-center gap-0.5"
              title={`Permanent pair: ${player.permanentPartnerNickname}`}
            >
              <Link2 className="h-2.5 w-2.5" /> {player.permanentPartnerNickname}
            </span>
          )}
          {pairRequest && (
            <span
              className="text-forest inline-flex items-center gap-0.5"
              title={`Wants to partner with ${pairRequest.targetNickname}`}
            >
              <HeartHandshake className="h-2.5 w-2.5" /> {pairRequest.targetNickname}
            </span>
          )}
          {againstRequest && (
            <span
              className="text-coral inline-flex items-center gap-0.5"
              title={`Wants to play against ${againstRequest.targetNickname}`}
            >
              <Crosshair className="h-2.5 w-2.5" /> {againstRequest.targetNickname}
            </span>
          )}
        </div>
      </div>

      {player.status === "WAITING" && (
        <>
          <span
            className="bg-cream-deep text-ink-soft shrink-0 rounded-md px-1.5 py-1 font-mono text-[10px] font-bold tabular-nums"
            title="Waiting time"
          >
            {formatDuration(wait)}
          </span>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={onPriority}
              disabled={pending}
              className={cn(
                "text-muted hover:bg-cream-deep grid h-7 w-7 place-items-center rounded-full transition",
                player.priority && "text-lime-deep",
              )}
              title={player.priority ? "Clear priority" : "Mark priority"}
            >
              <Star className={cn("h-3.5 w-3.5", player.priority && "fill-current")} />
            </button>
            <button
              type="button"
              onClick={onDone}
              disabled={pending}
              className="text-muted hover:bg-cream-deep hover:text-ink grid h-7 w-7 place-items-center rounded-full transition"
              title="Mark done for the day"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}

      {player.status === "EXPECTED" && (
        <Button size="sm" variant="accent" onClick={onCheckIn} disabled={pending} className="shrink-0">
          <UserCheck className="h-3.5 w-3.5" /> In
        </Button>
      )}

      {player.status === "PLAYING" && (
        <span className="bg-forest/10 text-forest shrink-0 rounded-full px-2 py-1 text-[9px] font-bold tracking-wide uppercase">
          On court
        </span>
      )}

      {player.status === "DONE" && (
        <Button size="sm" variant="paper" onClick={onRequeue} disabled={pending} className="shrink-0">
          Requeue
        </Button>
      )}
    </div>
  );
}

function ScorePad({
  label,
  team,
  value,
  onChange,
  target,
}: {
  label: string;
  team: BoardMatch["team1"];
  value: string;
  onChange: (value: string) => void;
  target: number;
}) {
  const step = (delta: number) => {
    const current = Number(value) || 0;
    onChange(String(Math.max(0, Math.min(99, current + delta))));
  };
  return (
    <div className="border-line bg-cream/40 rounded-2xl border p-3">
      <p className="text-muted text-center text-[9px] font-bold tracking-[0.14em] uppercase">{label}</p>
      <p className="mt-1 truncate text-center text-[11px] font-semibold">
        {team.map((player) => player.nickname).join(" & ")}
      </p>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
        inputMode="numeric"
        placeholder="0"
        className="placeholder:text-line-strong mt-2 w-full bg-transparent text-center font-mono text-5xl leading-none font-bold tracking-tight outline-none"
        aria-label={`${label} score`}
      />
      <div className="mt-2 flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => step(-1)}
          className="border-line bg-paper hover:bg-cream-deep grid h-7 w-7 place-items-center rounded-full border text-xs font-bold"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onChange(String(target))}
          className="border-line bg-paper hover:bg-cream-deep rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold"
        >
          {target}
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          className="border-line bg-paper hover:bg-cream-deep grid h-7 w-7 place-items-center rounded-full border text-xs font-bold"
        >
          +
        </button>
      </div>
    </div>
  );
}
