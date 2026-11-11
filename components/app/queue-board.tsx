"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  Activity,
  AlertCircle,
  LogOut,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Crosshair,
  Download,
  Flag,
  GripVertical,
  HeartHandshake,
  LayoutGrid,
  ListOrdered,
  Link2,
  Pencil,
  Shuffle,
  ChevronUp,
  ChevronDown,
  Undo2,
  Play,
  Plus,
  Gift,
  Minus,
  AlarmClock,
  Search,
  Settings2,
  Share2,
  Copy,
  ExternalLink,
  Star,
  UserCheck,
  UserRoundPlus,
  Users,
  Wand2,
  XCircle,
  Zap,
} from "lucide-react";
import {
  addCourt,
  endGameDay,
  extendGameDay,
  removeCourt,
  renameCourt,
  restoreMatch,
  cancelMatch,
  checkInPlayer,
  undoCheckIn,
  clearSuggestedMatches,
  completeMatch,
  createManualMatch,
  generateMatches,
  reorderQueuedGame,
  regenerateMatches,
  confirmLeaveRequest,
  declineLeaveRequest,
  markPlayerDone,
  moveMatchToCourt,
  requeuePlayer,
  setGameDayStatus,
  startAllSuggested,
  startMatch,
  swapMatchPlayers,
  togglePriority,
  updateMatchPlayers,
  addWalkIn,
} from "@/lib/actions/gamedays";
import type { BoardData, BoardMatch, BoardPlayer } from "@/lib/board-types";
import { CATEGORY_SHORT, GAMEDAY_TYPE_LABELS } from "@/lib/fees";
import { LEVELS, levelLabel, levelValue } from "@/lib/levels";
import { canDropOn } from "@/lib/drag-targets";
import { GAME_MINUTES, planTimeline } from "@/lib/planning";
import {
  courtName,
  formatClock,
  formatDuration,
  formatGameDate,
  minutesLeftInReservation,
  offersFreeGame,
  QUEUED_COURT,
  reservationEnd,
  timeToMinutes,
} from "@/lib/datetime";
import { CourtLines } from "@/components/app/court-surface";
import { Avatar } from "@/components/ui/avatar";
import { Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type AnyResult = { ok: true; message?: string } | { ok: false; error: string };
type QueueTab = "waiting" | "playing" | "expected" | "done";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not refresh the board");
  return response.json() as Promise<BoardData>;
};

/**
 * Ticking clock for wait timers. It deliberately starts at 0 so the server and
 * the first client render agree (Date.now() during render is a hydration
 * mismatch); the effect fills in the real time immediately after mount.
 */
function useNow() {
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const kick = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, []);
  return now;
}

/**
 * dnd-kit generates `aria-describedby` ids from a module counter, so the ids
 * differ between the server render and the client render. Only attach its
 * drag attributes after hydration.
 */
function useMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function waitSeconds(queuedAt: string | null, now: number) {
  if (!queuedAt) return 0;
  return Math.max(0, Math.floor((now - Date.parse(queuedAt)) / 1000));
}

function teamValue(team: { level: string }[]) {
  return team.reduce((sum, player) => sum + levelValue(player.level), 0);
}

type DragPayload =
  | { kind: "match"; matchId: string; courtNumber: number }
  | {
      kind: "match-player";
      matchId: string;
      playerId: string;
      team: number;
      slot: number;
      nickname: string;
      level: string;
    }
  | { kind: "queue-player"; playerId: string; nickname: string; level: string; status: string };

type DropTarget =
  | { kind: "court"; courtNumber: number; matchId?: string }
  | { kind: "slot"; matchId: string; team: number; slot: number; playerId: string }
  | { kind: "draft-slot"; courtNumber: number; index: number };

/** Only offer a drag the targets it can land on (see `canDropOn`). */
const collisionFor: CollisionDetection = (args) =>
  closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) =>
      canDropOn(
        args.active.data.current as DragPayload | undefined,
        container.data.current as DropTarget | undefined,
      ),
    ),
  });

const EMPTY_DRAFT: Array<string | null> = [null, null, null, null];

function lineupOf(match: BoardMatch) {
  const order = (team: BoardMatch["team1"]) =>
    [...team].sort((a, b) => a.slot - b.slot).map((player) => player.playerId);
  return { team1: order(match.team1), team2: order(match.team2) };
}

export function QueueBoard({ initialData, livePath }: { initialData: BoardData; livePath: string }) {
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
  const [addCourtOpen, setAddCourtOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const router = useRouter();
  // Reservation-end prompt: snoozing hides it until the given time on this device.
  const [snoozedUntil, setSnoozedUntil] = React.useState(0);
  const [extendUntil, setExtendUntil] = React.useState("");
  const [extendCourts, setExtendCourts] = React.useState(0);
  const [countLiveGames, setCountLiveGames] = React.useState(true);
  const [renameTarget, setRenameTarget] = React.useState<{ court: number; name: string } | null>(null);
  const [renameLabel, setRenameLabel] = React.useState("");
  const [renameEveryBlock, setRenameEveryBlock] = React.useState(true);
  const [shareUrl, setShareUrl] = React.useState(livePath);
  const [newCourtLabel, setNewCourtLabel] = React.useState("");
  const [freePrompt, setFreePrompt] = React.useState<{
    count: number;
    minutesLeft: number;
    run: (free: boolean) => void;
  } | null>(null);
  const [walk, setWalk] = React.useState({ nickname: "", level: "C", category: "ACTIVE" });
  const [confirmSpec, setConfirmSpec] = React.useState<ConfirmSpec | null>(null);
  const [editMatch, setEditMatch] = React.useState<BoardMatch | null>(null);
  const [editCourt, setEditCourt] = React.useState(1);
  const [editTeam1, setEditTeam1] = React.useState<string[]>([]);
  const [editTeam2, setEditTeam2] = React.useState<string[]>([]);
  const [drafts, setDrafts] = React.useState<Record<number, Array<string | null>>>({});
  const [activeDrag, setActiveDrag] = React.useState<DragPayload | null>(null);
  const creatingDrafts = React.useRef<Set<number>>(new Set());
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold to pick up on a tablet, so a quick swipe still scrolls the queue.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const playerById = React.useMemo(
    () => new Map(data.players.map((player) => [player.playerId, player])),
    [data.players],
  );

  const act = (fn: () => Promise<AnyResult>, onSuccess?: () => void) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        haptic("success");
        toast.success(result.message ?? "Saved.");
        onSuccess?.();
        await mutate();
      } else {
        haptic("warning");
        toast.error(result.error);
      }
    });
  };

  // "I'm leaving" requests from the live link: tell the queue master the moment one arrives.
  const announcedLeaves = React.useRef(new Set<string>());
  React.useEffect(() => {
    for (const request of data.leaveRequests) {
      if (announcedLeaves.current.has(request.id)) continue;
      announcedLeaves.current.add(request.id);
      toast.warning(`${request.nickname} wants to leave. Confirm or keep them on the board.`, {
        duration: 15000,
      });
    }
  }, [data.leaveRequests]);

  const placeInDraft = (court: number, index: number, playerId: string) => {
    const current = drafts[court] ?? EMPTY_DRAFT;
    const next = current.map((id) => (id === playerId ? null : id));
    next[index] = playerId;
    setDrafts((prev) => ({ ...prev, [court]: next }));

    if (!next.every(Boolean) || creatingDrafts.current.has(court)) return;
    creatingDrafts.current.add(court);

    startTransition(async () => {
      const result = await createManualMatch(data.gameDay.id, court, next as string[]);
      if (result.ok) toast.success(result.message ?? "Court set.");
      else toast.error(result.error);
      creatingDrafts.current.delete(court);
      setDrafts((prev) => ({ ...prev, [court]: EMPTY_DRAFT }));
      await mutate();
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const active = event.active.data.current as DragPayload | undefined;
    const over = event.over?.data.current as DropTarget | undefined;
    if (!active || !over || isCompleted) return;
    haptic("tap");

    if (active.kind === "match") {
      if (over.kind === "court" && over.courtNumber !== QUEUED_COURT) {
        act(() => moveMatchToCourt(active.matchId, over.courtNumber));
      } else if (
        // A waiting game dropped on another waiting game takes its place in line.
        over.kind === "court" &&
        over.courtNumber === QUEUED_COURT &&
        over.matchId &&
        active.courtNumber === QUEUED_COURT
      ) {
        const toIndex = queued.findIndex((game) => game.id === over.matchId);
        if (toIndex >= 0) act(() => reorderQueuedGame(data.gameDay.id, active.matchId, toIndex));
      }
      return;
    }

    if (active.kind === "queue-player") {
      // Someone still on court can only be planned into a waiting game, never put on a court to start now.
      if (active.status === "PLAYING") {
        const target =
          over.kind === "slot" || (over.kind === "court" && over.matchId)
            ? data.activeMatches.find((item) => item.id === over.matchId)?.courtNumber
            : over.courtNumber;
        if (target !== QUEUED_COURT) {
          toast.error(`${active.nickname} is still playing. Drop them into a waiting game to plan ahead.`);
          return;
        }
      }
      if (over.kind === "draft-slot") {
        placeInDraft(over.courtNumber, over.index, active.playerId);
        return;
      }
      if (over.kind === "court" && !over.matchId) {
        const current = drafts[over.courtNumber] ?? EMPTY_DRAFT;
        const empty = current.findIndex((id) => id === null);
        if (empty >= 0) placeInDraft(over.courtNumber, empty, active.playerId);
        return;
      }
      if (over.kind === "slot") {
        if (over.playerId === active.playerId) return;
        const match = data.activeMatches.find((item) => item.id === over.matchId);
        if (!match) return;
        const lineup = lineupOf(match);
        const next = over.team === 1 ? [...lineup.team1] : [...lineup.team2];
        next[over.slot - 1] = active.playerId;
        act(() =>
          over.team === 1
            ? updateMatchPlayers(match.id, next, lineup.team2)
            : updateMatchPlayers(match.id, lineup.team1, next),
        );
      }
      return;
    }

    if (active.kind === "match-player") {
      if (over.kind !== "slot" || over.playerId === active.playerId) return;
      if (over.matchId !== active.matchId) {
        act(() => swapMatchPlayers(active.matchId, active.playerId, over.matchId, over.playerId));
        return;
      }

      const match = data.activeMatches.find((item) => item.id === active.matchId);
      if (!match) return;
      const lineup = lineupOf(match);
      const team1 = [...lineup.team1];
      const team2 = [...lineup.team2];
      const from = active.team === 1 ? team1 : team2;
      const to = over.team === 1 ? team1 : team2;
      const fromIndex = active.slot - 1;
      const toIndex = over.slot - 1;
      const swap = to[toIndex];
      to[toIndex] = from[fromIndex];
      from[fromIndex] = swap;
      act(() => updateMatchPlayers(match.id, team1, team2));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    haptic("tap");
    setActiveDrag((event.active.data.current as DragPayload | undefined) ?? null);
  };

  const plan = data.gameDay.courtPlan;
  const slot = plan[data.activeSlotIndex] ?? plan[0];
  const suggested = data.activeMatches.filter(
    (match) => match.status === "SUGGESTED" && match.courtNumber !== QUEUED_COURT,
  );
  // Next up line: paired games waiting for a court, oldest first (the board query orders by creation).
  const queued = data.activeMatches.filter((match) => match.courtNumber === QUEUED_COURT);
  const courtsFull = data.stats.courtsTotal > 0 && data.stats.courtsOpen === 0;

  // Planned games can include players still on court. Say who each one is waiting on, and when.
  const planNotes = (() => {
    if (!now || queued.length === 0) return new Map<string, string>();
    const liveByPlayer = new Map<string, BoardMatch>();
    for (const match of data.activeMatches) {
      if (match.status !== "LIVE") continue;
      for (const row of [...match.team1, ...match.team2]) liveByPlayer.set(row.playerId, match);
    }
    const timeline = planTimeline({
      now,
      totalCourts: data.stats.courtsTotal,
      busy: data.activeMatches
        .filter((match) => match.courtNumber !== QUEUED_COURT)
        .map((match) => ({
          courtNumber: match.courtNumber,
          startedAt: match.status === "LIVE" && match.startedAt ? Date.parse(match.startedAt) : null,
        })),
      queuedGames: queued.length,
    });
    const notes = new Map<string, string>();
    queued.forEach((match, index) => {
      const still = [...match.team1, ...match.team2].filter((row) => liveByPlayer.has(row.playerId));
      if (still.length === 0) return;
      // "Paolo and Rica (Court 5)": names grouped by the court they are finishing on.
      const byCourt = new Map<number, string[]>();
      for (const row of still) {
        const court = liveByPlayer.get(row.playerId)!.courtNumber;
        byCourt.set(court, [...(byCourt.get(court) ?? []), row.nickname]);
      }
      const names = [...byCourt.entries()]
        .map(([court, nicknames]) => `${nicknames.join(" and ")} (${courtName(slot, court)})`)
        .join(", ");
      notes.set(
        match.id,
        `Plans around ${names}. Starts about ${formatClock(new Date(timeline.starts[index]))}, once they finish (~${GAME_MINUTES} min a game).`,
      );
    });
    return notes;
  })();
  const live = data.activeMatches.filter((match) => match.status === "LIVE");
  const courtCount = Math.max(
    data.stats.courtsTotal,
    ...data.activeMatches.map((match) => match.courtNumber),
    1,
  );
  const courtNumbers = Array.from({ length: courtCount }, (_, index) => index + 1);
  const isDraft = data.gameDay.status === "DRAFT";
  const isCompleted = data.gameDay.status === "COMPLETED";

  // When the reserved time runs out on the game day itself, ask whether to extend or end.
  const bookedUntil = reservationEnd(plan);
  const minutesLeft = now ? minutesLeftInReservation(plan, data.gameDay.date, new Date(now)) : null;
  const reservationOver = data.gameDay.status === "LIVE" && minutesLeft !== null && minutesLeft <= 0;
  const endPromptOpen = reservationOver && now >= snoozedUntil;
  const lastBlock = plan.find((block) => block.end === bookedUntil);
  const suggestedUntil = bookedUntil
    ? (() => {
        const minutes = Math.min(timeToMinutes(bookedUntil) + 60, 23 * 60 + 59);
        return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      })()
    : "";
  const snoozeEndPrompt = () => setSnoozedUntil(Date.now() + 10 * 60 * 1000);

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

  const openEdit = (match: BoardMatch) => {
    setEditMatch(match);
    setEditCourt(match.courtNumber);
    setEditTeam1(match.team1.map((player) => player.playerId));
    setEditTeam2(match.team2.map((player) => player.playerId));
  };

  // Near closing time a game may not finish, so ask whether it is a free game
  // (used shuttle, not counted) before it starts.
  // Starting a game whose player is still on another court is refused; offer to re-pair it instead.
  const startGame = (matchId: string, free: boolean) => {
    startTransition(async () => {
      const result = await startMatch(matchId, { free });
      if (result.ok) {
        haptic("success");
        toast.success(result.message ?? "Started.");
      } else if (result.code === "PLAYER_STILL_PLAYING") {
        setConfirmSpec({
          title: "Someone is still on court",
          description: result.error,
          confirmLabel: "Re-pair this game",
          cancelLabel: "Keep it for now",
          onConfirm: () => act(() => regenerateMatches(data.gameDay.id, slotIndex, matchId)),
        });
      } else {
        toast.error(result.error);
      }
      await mutate();
    });
  };

  // Pair a court. Players already dropped on it stay (on the side they were put), and the engine
  // fills the empty places. With none dropped it pairs all four.
  const pairCourt = (court: number) => {
    const seeds = (drafts[court] ?? EMPTY_DRAFT).flatMap((playerId, index) =>
      playerId ? [{ playerId, team: (index < 2 ? 1 : 2) as 1 | 2 }] : [],
    );
    act(
      () =>
        court === QUEUED_COURT
          ? generateMatches(data.gameDay.id, slotIndex, 1, { queue: true, seeds })
          : generateMatches(data.gameDay.id, slotIndex, 1, { courtNumber: court, seeds }),
      () => setDrafts((prev) => ({ ...prev, [court]: EMPTY_DRAFT })),
    );
  };

  // Undo a check-in made by mistake; the toast offers to put them straight back.
  const undoCheckInFor = (sessionPlayerId: string) => {
    startTransition(async () => {
      const result = await undoCheckIn(sessionPlayerId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Check-in undone.", {
        duration: 8000,
        action: { label: "Check in again", onClick: () => act(() => checkInPlayer(sessionPlayerId)) },
      });
      await mutate();
    });
  };

  const requestStart = (count: number, run: (free: boolean) => void) => {
    const minutesLeft = minutesLeftInReservation(plan, data.gameDay.date, new Date());
    if (offersFreeGame(minutesLeft)) setFreePrompt({ count, minutesLeft: minutesLeft!, run });
    else run(false);
  };

  const openAddCourt = () => {
    const labels = (slot?.courtLabels ?? []).map((label) => label.trim());
    const numbers = labels.filter((label) => /^\d+$/.test(label)).map(Number);
    // Courts named 5, 6, 7 suggest 8 for the next one.
    setNewCourtLabel(
      slot && numbers.length === slot.courts && numbers.length > 0 ? String(Math.max(...numbers) + 1) : "",
    );
    setAddCourtOpen(true);
  };

  // Ending a game offers Undo for a few seconds, in case it was ended by mistake.
  const endGame = (matchId: string) => {
    startTransition(async () => {
      const result = await completeMatch(matchId);
      if (!result.ok) {
        haptic("warning");
        toast.error(result.error);
        return;
      }
      haptic("success");
      toast.success(result.message ?? "Game ended.", {
        duration: 10000,
        action: { label: "Undo", onClick: () => act(() => restoreMatch(matchId)) },
      });
      await mutate();
    });
  };

  const confirmRestore = (match: BoardMatch) =>
    setConfirmSpec({
      title: `Restore the game on ${courtName(slot, match.courtNumber)}?`,
      description:
        "It goes back on court as live and the timer keeps running from its start. Their game counts go back down until it ends again.",
      confirmLabel: "Restore game",
      cancelLabel: "Keep it finished",
      onConfirm: () => act(() => restoreMatch(match.id)),
    });

  const finishMatch = (match: BoardMatch) => {
    setConfirmSpec({
      title: `End the game on ${courtName(slot, match.courtNumber)}?`,
      description: match.free
        ? "Free game — it won't count toward anyone's games or fees. All four requeue automatically."
        : "All four players requeue automatically.",
      detail: (
        <div className="border-line bg-cream/70 space-y-1.5 rounded-xl border px-3.5 py-3">
          {[
            ["Team A", match.team1],
            ["Team B", match.team2],
          ].map(([label, team]) => (
            <p key={label as string} className="flex items-center justify-between gap-3 text-[12px]">
              <span className="text-muted shrink-0 font-semibold tracking-wide uppercase">
                {label as string}
              </span>
              <span className="truncate font-semibold">
                {(team as BoardMatch["team1"]).map((player) => player.nickname).join(" & ")}
              </span>
            </p>
          ))}
          <p className="text-muted pt-0.5 text-[11px]">
            Round {match.round} · doubles · {match.free ? "free game, not counted" : "fee counts on end"}
          </p>
        </div>
      ),
      confirmLabel: "End game",
      cancelLabel: "Keep playing",
      onConfirm: () => endGame(match.id),
    });
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
        const moved = await moveMatchToCourt(editMatch.id, editCourt);
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
    <DndContext
      sensors={sensors}
      collisionDetection={collisionFor}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="space-y-5">
        {data.leaveRequests.length > 0 && (
          <section aria-live="assertive" className="border-gold/60 bg-gold/15 rounded-2xl border-2 p-4">
            <h2 className="font-display inline-flex items-center gap-2 text-base font-bold">
              <LogOut className="h-4 w-4" /> Leaving the game day · {data.leaveRequests.length}
            </h2>
            <p className="text-muted text-[12px]">
              Players asked from the live link to be taken out. Confirm to mark them done.
            </p>
            <ul className="mt-3 space-y-2">
              {data.leaveRequests.map((request) => (
                <li
                  key={request.id}
                  className="border-line flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2.5"
                >
                  <div>
                    <p className="text-[15px] font-bold">{request.nickname}</p>
                    <p className="text-muted text-[11px]">
                      {request.playerStatus === "PLAYING"
                        ? "In a live game. Confirm after it finishes."
                        : request.playerStatus === "WAITING"
                          ? "Waiting in the queue"
                          : request.playerStatus}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={pending}
                      onClick={() => act(() => confirmLeaveRequest(request.id))}
                    >
                      <Check className="h-3.5 w-3.5" /> Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="paper"
                      disabled={pending}
                      onClick={() => act(() => declineLeaveRequest(request.id))}
                    >
                      Keep in queue
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

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
                      ? "animate-live-ring bg-emerald-500 text-emerald-500"
                      : "bg-current opacity-50",
                  )}
                />
                {data.gameDay.status}
              </span>
            </div>
            <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {data.gameDay.name}
            </h1>
            <p
              data-trim-id="board.subtitle"
              className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]"
            >
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
            <Button
              variant="accent"
              size="sm"
              onClick={() => {
                setShareUrl(`${window.location.origin}${livePath}`);
                setShareOpen(true);
              }}
            >
              <Share2 className="h-3.5 w-3.5" /> Share live view
            </Button>
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
          <div
            data-trim-id="board.draft-banner"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3"
          >
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
          <div
            data-trim-id="board.completed-banner"
            className="border-line bg-cream-deep/70 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
          >
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

        {/* Status rail: block switcher on top, live numbers below */}
        <Card className="overflow-hidden">
          <div className="border-line/70 flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
            <span
              data-trim-id="board.plan-label"
              className="text-muted ml-1 text-[10px] font-bold tracking-[0.16em] uppercase"
            >
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
            {plan.map((row, index) => {
              const active = data.activeSlotIndex === index;
              const current = plan[data.activeSlotIndex] === row && active;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSlotIndex(index)}
                  className={cn(
                    "press rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                    active
                      ? "bg-forest border-forest text-cream"
                      : "border-line bg-paper text-ink-soft hover:border-forest/40 hover:bg-cream/60",
                  )}
                >
                  <span className="font-mono">
                    {row.start}–{row.end}
                  </span>
                  <span className="ml-1.5 opacity-60">· {row.courts}c</span>
                  {row.label && <span className="ml-1.5 hidden opacity-60 sm:inline">{row.label}</span>}
                  {isValidating && current && (
                    <span className="bg-lime ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
                  )}
                </button>
              );
            })}
            <span
              data-trim-id="board.plan-clock"
              className="text-muted ml-auto inline-flex items-center gap-1.5 text-[11px]"
            >
              <Dot tone="lime" /> {now ? formatClock(new Date(now)) : "--:--"} Manila
            </span>
          </div>
          <div className="bg-line grid grid-cols-2 gap-px sm:grid-cols-5">
            <RailCell
              label="Waiting"
              value={data.stats.waiting}
              sub={`${data.stats.expected} still expected`}
              subTrimId="board.rail.waiting-sub"
            />
            <RailCell
              label="On court"
              value={data.stats.playing}
              sub={`${data.stats.courtsBusy}/${data.stats.courtsTotal} courts busy`}
              subTrimId="board.rail.playing-sub"
            />
            <RailCell
              label="Open courts"
              value={`${data.stats.courtsOpen}/${data.stats.courtsTotal}`}
              sub="in the selected block"
              subTrimId="board.rail.open-sub"
            />
            <RailCell
              label="Games today"
              value={data.stats.gamesCompleted}
              sub={`${data.stats.totalGamesPlayed} player-games`}
              subTrimId="board.rail.games-sub"
            />
            <RailCell
              label="Longest wait"
              value={`${data.stats.longestWaitMinutes}m`}
              sub={`avg ${data.stats.averageWaitMinutes}m`}
              subTrimId="board.rail.wait-sub"
              warn={now > 0 && data.stats.longestWaitMinutes >= 20}
              className="col-span-2 sm:col-span-1"
            />
          </div>
        </Card>

        {/* Main actions stay in reach while scrolling the courts and queue. */}
        <div className="glass border-line/60 bg-cream/80 sticky top-15 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
          <Button
            onClick={() => act(() => generateMatches(data.gameDay.id, slotIndex))}
            disabled={pending || isCompleted}
            className="flex-1 sm:flex-none"
          >
            {courtsFull ? (
              <>
                <ListOrdered className="h-4 w-4" /> Queue next game
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Auto-pair
                {slot ? ` (${Math.min(data.stats.waiting, slot.courts * 4)} max)` : ""}
              </>
            )}
          </Button>
          <Button
            variant="accent"
            onClick={() => setCheckOpen(true)}
            disabled={isCompleted}
            className="flex-1 sm:flex-none"
          >
            <UserCheck className="h-4 w-4" /> Check in
          </Button>
          <Button
            variant="paper"
            onClick={() => setWalkOpen(true)}
            disabled={isCompleted}
            className="flex-1 sm:flex-none"
          >
            <UserRoundPlus className="h-4 w-4" /> Walk-in
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_370px]">
          <div className="@container space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-lg font-bold tracking-tight">Courts</h2>
                <span data-trim-id="board.courts-block" className="text-muted text-[11px]">
                  {slot ? `Block ${slot.start}–${slot.end}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {suggested.length > 0 && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        requestStart(suggested.length, (free) =>
                          act(() => startAllSuggested(data.gameDay.id, { free })),
                        )
                      }
                      loading={pending}
                    >
                      <Play className="h-3.5 w-3.5" /> Start all ({suggested.length})
                    </Button>
                    <Button
                      variant="paper"
                      size="sm"
                      onClick={() => act(() => regenerateMatches(data.gameDay.id, slotIndex))}
                      disabled={pending}
                      title="Don't like these pairings? Get different ones. Press again for more."
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Regenerate
                    </Button>
                    <button
                      type="button"
                      className="text-muted hover:text-ink text-[11px] font-semibold transition"
                      onClick={() =>
                        setConfirmSpec({
                          title: "Clear all suggested matches?",
                          description: `${suggested.length} suggested game${
                            suggested.length === 1 ? "" : "s"
                          } discarded. Players stay in the queue.`,
                          confirmLabel: "Clear suggestions",
                          cancelLabel: "Keep suggestions",
                          tone: "danger",
                          onConfirm: () => act(() => clearSuggestedMatches(data.gameDay.id)),
                        })
                      }
                    >
                      Clear
                    </button>
                  </>
                )}
                {slot && !isCompleted && (
                  <Button variant="paper" size="sm" onClick={openAddCourt} disabled={pending}>
                    <Plus className="h-3.5 w-3.5" /> Add court
                  </Button>
                )}
                <span
                  data-trim-id="board.live-count"
                  className="text-muted inline-flex items-center gap-1.5 text-[11px]"
                >
                  <Dot tone={live.length ? "green" : "muted"} /> {live.length} live
                </span>
              </div>
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
              <>
                <p
                  data-trim-id="board.drag-hint"
                  className="border-line bg-paper/70 text-muted flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]"
                >
                  <GripVertical className="text-forest h-3.5 w-3.5" />
                  Drag a court card onto another court to swap them. Drag a player onto a slot to swap
                  players, or fill an open court with four dropped players.
                </p>
                <div className="grid gap-3 @lg:grid-cols-2 @5xl:grid-cols-3">
                  {courtNumbers.map((court) => {
                    const match = data.activeMatches.find((item) => item.courtNumber === court);
                    return (
                      <CourtCard
                        key={`${court}-${match?.id ?? "open"}`}
                        court={court}
                        name={courtName(slot, court)}
                        match={match}
                        draft={drafts[court] ?? EMPTY_DRAFT}
                        playerById={playerById}
                        now={now}
                        pending={pending}
                        isCompleted={isCompleted}
                        onPair={() => pairCourt(court)}
                        onStart={(id) => requestStart(1, (free) => startGame(id, free))}
                        onRegenerate={(id) => act(() => regenerateMatches(data.gameDay.id, slotIndex, id))}
                        onFinish={finishMatch}
                        onEdit={openEdit}
                        onCancel={(id) =>
                          setConfirmSpec({
                            title: "Cancel this match?",
                            description: "Players will stay in the queue.",
                            confirmLabel: "Cancel match",
                            cancelLabel: "Keep match",
                            tone: "danger",
                            onConfirm: () => act(() => cancelMatch(id)),
                          })
                        }
                        onRename={() => {
                          const current = slot?.courtLabels?.[court - 1]?.trim();
                          setRenameLabel(current || String(court));
                          setRenameEveryBlock(true);
                          setRenameTarget({ court, name: courtName(slot, court) });
                        }}
                        onRemove={() =>
                          setConfirmSpec({
                            title: `Remove ${courtName(slot, court)}?`,
                            description: match
                              ? `It leaves ${slot?.label ?? "this block"}. The suggested game on it moves to the waiting courts, and the other courts keep their names.`
                              : `It leaves ${slot?.label ?? "this block"}. The other courts keep their names. Add it back with Add court.`,
                            confirmLabel: "Remove court",
                            cancelLabel: "Keep court",
                            tone: "danger",
                            onConfirm: () => act(() => removeCourt(data.gameDay.id, slotIndex, court)),
                          })
                        }
                        onClearDraft={(index) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [court]: (prev[court] ?? EMPTY_DRAFT).map((id, position) =>
                              position === index ? null : id,
                            ),
                          }))
                        }
                      />
                    );
                  })}
                </div>
                {!isCompleted && (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-display inline-flex items-center gap-1.5 text-base font-bold">
                        <ListOrdered className="h-4 w-4" /> Waiting courts
                        {queued.length > 0 && (
                          <span className="text-muted font-mono text-[11px] font-bold">
                            · {queued.length} in line
                          </span>
                        )}
                      </h3>
                      <span data-trim-id="board.waiting-hint" className="text-muted text-[11px]">
                        Plan ahead, even with players still on court. Each game takes the next court that
                        frees up, in order. Add as many as you like, beyond the reserved courts. A player can
                        sit in several planned games but can&apos;t be on two playing courts at once.
                      </span>
                    </div>
                    <div className="grid gap-3 @lg:grid-cols-2 @5xl:grid-cols-3">
                      {[...queued, undefined].map((match, index) => (
                        <div key={match?.id ?? "waiting-new"} className="space-y-1.5">
                          <CourtCard
                            court={QUEUED_COURT}
                            name={match ? `Waiting ${index + 1}` : "Waiting court"}
                            match={match}
                            queuePosition={match ? index + 1 : undefined}
                            canStart={!courtsFull}
                            draft={drafts[QUEUED_COURT] ?? EMPTY_DRAFT}
                            playerById={playerById}
                            now={now}
                            pending={pending}
                            isCompleted={isCompleted}
                            onPair={() => pairCourt(QUEUED_COURT)}
                            onStart={(id) => requestStart(1, (free) => startGame(id, free))}
                            onRegenerate={(id) =>
                              act(() => regenerateMatches(data.gameDay.id, slotIndex, id))
                            }
                            onMoveUp={
                              match && index > 0
                                ? () => act(() => reorderQueuedGame(data.gameDay.id, match.id, index - 1))
                                : undefined
                            }
                            onMoveDown={
                              match && index < queued.length - 1
                                ? () => act(() => reorderQueuedGame(data.gameDay.id, match.id, index + 1))
                                : undefined
                            }
                            onFinish={finishMatch}
                            onEdit={openEdit}
                            onCancel={(id) =>
                              setConfirmSpec({
                                title: "Remove this waiting game?",
                                description: "The four players stay in the queue.",
                                confirmLabel: "Remove game",
                                cancelLabel: "Keep it",
                                tone: "danger",
                                onConfirm: () => act(() => cancelMatch(id)),
                              })
                            }
                            onClearDraft={(slotPosition) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [QUEUED_COURT]: (prev[QUEUED_COURT] ?? EMPTY_DRAFT).map((id, position) =>
                                  position === slotPosition ? null : id,
                                ),
                              }))
                            }
                          />
                          {match && planNotes.get(match.id) && (
                            <p className="border-gold/60 bg-gold/15 text-ink rounded-xl border px-3 py-2 text-[11px] leading-snug">
                              {planNotes.get(match.id)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {data.recentMatches.length > 0 && (
              <div data-trim-id="board.recent" className="border-line bg-paper/70 rounded-2xl border p-4">
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
                      <span className="text-muted max-w-[8rem] truncate font-mono font-bold">
                        {courtName(slot, match.courtNumber)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {match.team1.map((player) => player.nickname).join(" & ")}
                        <span className="text-muted mx-1.5">vs</span>
                        {match.team2.map((player) => player.nickname).join(" & ")}
                      </span>
                      {match.free && <FreeTag />}
                      <span className="text-muted font-mono text-[10px] font-bold">
                        <CircleCheck className="text-forest inline h-3 w-3 align-[-2px]" />{" "}
                        {match.endedAt ? formatClock(match.endedAt) : "Done"}
                      </span>
                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => confirmRestore(match)}
                          disabled={pending}
                          title="Ended by mistake? Put this game back on court"
                          className="border-line text-ink-soft hover:border-forest hover:bg-lime/20 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-40"
                        >
                          <Undo2 className="h-3 w-3" /> Restore
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Card className="h-fit lg:sticky lg:top-24">
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
                      "press shrink-0 rounded-full px-3 py-2 text-[11px] font-semibold",
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
                      draggable={
                        (player.status === "WAITING" || player.status === "PLAYING") &&
                        !pending &&
                        !isCompleted
                      }
                      player={player}
                      now={now}
                      pending={pending}
                      onCheckIn={() => act(() => checkInPlayer(player.sessionPlayerId))}
                      onUndoCheckIn={() => undoCheckInFor(player.sessionPlayerId)}
                      onDone={() =>
                        setConfirmSpec({
                          title: `Mark ${player.nickname} done for the day?`,
                          description: "They leave the board and stop receiving games.",
                          confirmLabel: "Mark done",
                          cancelLabel: "Not yet",
                          onConfirm: () => act(() => markPlayerDone(player.sessionPlayerId)),
                        })
                      }
                      onRequeue={() => act(() => requeuePlayer(player.sessionPlayerId))}
                      onPriority={() => act(() => togglePriority(player.sessionPlayerId))}
                    />
                  ))}
                </div>
              )}
            </div>

            <div
              data-trim-id="board.queue-footer"
              className="border-line/80 flex items-center justify-between border-t px-4 py-3"
            >
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

        <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />

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
                      {level.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Player type">
                <Select
                  value={walk.category}
                  onChange={(event) => setWalk({ ...walk, category: event.target.value })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ALUMNI">Alumni</option>
                  <option value="APPLICANT">Applicant</option>
                  <option value="NON_AFFILIATE">Non-affiliate</option>
                </Select>
              </Field>
            </div>
            <p className="bg-cream-deep/60 text-muted rounded-xl px-3 py-2 text-[11px]">
              If the nickname already exists, their saved level and player type will be used.
            </p>
          </div>
        </Modal>

        {/* Reservation is over: extend or end the game day */}
        <Modal
          open={endPromptOpen}
          onClose={snoozeEndPrompt}
          title="Reservation time is up"
          description={`The courts were booked until ${bookedUntil ?? "now"}. Extend the game day, or end it and collect fees.`}
          size="md"
          footer={
            <Button variant="ghost" onClick={snoozeEndPrompt}>
              <AlarmClock className="h-4 w-4" /> Remind me in 10 min
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="border-line rounded-2xl border p-4">
              <p className="font-display text-[15px] font-bold">Extend the game day</p>
              <p className="text-muted mb-3 text-[12px]">
                Adds a block from {bookedUntil} with the courts you still have.
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Until">
                  <Input
                    type="time"
                    value={extendUntil || suggestedUntil}
                    onChange={(event) => setExtendUntil(event.target.value)}
                  />
                </Field>
                <Field label="Courts">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={extendCourts || lastBlock?.courts || 1}
                    onChange={(event) => setExtendCourts(Number(event.target.value))}
                  />
                </Field>
                <Button
                  onClick={() =>
                    act(
                      () =>
                        extendGameDay(
                          data.gameDay.id,
                          extendUntil || suggestedUntil,
                          extendCourts || lastBlock?.courts || 1,
                        ),
                      () => {
                        setExtendUntil("");
                        setExtendCourts(0);
                      },
                    )
                  }
                  loading={pending}
                >
                  <Plus className="h-4 w-4" /> Extend
                </Button>
              </div>
            </div>

            <div className="border-line rounded-2xl border p-4">
              <p className="font-display text-[15px] font-bold">End the game day</p>
              <p className="text-muted mb-3 text-[12px]">
                Closes the board and takes you to Fees to collect payments. Reports are ready after.
              </p>
              {live.length > 0 && (
                <label className="text-ink-soft mb-3 flex items-start gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={countLiveGames}
                    onChange={(event) => setCountLiveGames(event.target.checked)}
                    className="accent-forest mt-0.5 h-4 w-4"
                  />
                  <span>
                    Count the {live.length} game{live.length === 1 ? "" : "s"} still on court as played (
                    {live.map((match) => courtName(slot, match.courtNumber)).join(", ")})
                  </span>
                </label>
              )}
              <Button
                variant="danger"
                onClick={() =>
                  startTransition(async () => {
                    const result = await endGameDay(data.gameDay.id, live.length > 0 && countLiveGames);
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success(result.message ?? "Game day ended.");
                    router.push(`/app/gamedays/${data.gameDay.id}/fees`);
                  })
                }
                loading={pending}
              >
                <Flag className="h-4 w-4" /> End game day &amp; go to fees
              </Button>
            </div>
          </div>
        </Modal>

        {/* Free game prompt near closing time */}
        <Modal
          open={Boolean(freePrompt)}
          onClose={() => setFreePrompt(null)}
          title={
            freePrompt && freePrompt.count > 1
              ? `Start ${freePrompt.count} games as free games?`
              : "Is this a free game?"
          }
          description={
            freePrompt
              ? freePrompt.minutesLeft > 0
                ? `Only ${freePrompt.minutesLeft} min left before the reservation ends. A game takes about 15 minutes.`
                : "The reservation time is up."
              : undefined
          }
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setFreePrompt(null)}>
                Cancel
              </Button>
              <Button
                variant="paper"
                onClick={() => {
                  freePrompt?.run(false);
                  setFreePrompt(null);
                }}
              >
                Regular game
              </Button>
              <Button
                onClick={() => {
                  freePrompt?.run(true);
                  setFreePrompt(null);
                }}
              >
                <Gift className="h-4 w-4" /> Free game
              </Button>
            </>
          }
        >
          <p className="bg-cream-deep/60 text-muted rounded-xl px-3 py-2 text-[12px]">
            A free game is played with a used shuttle. It does not count as a game played, so it is not added
            to anyone&apos;s fees.
          </p>
        </Modal>

        {/* Share live view modal */}
        <Modal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          title="Share the live queue"
          description="Anyone with this link can watch the courts, the Next up line, and the waiting order. They can't change anything."
          size="sm"
          footer={
            <>
              <a href={shareUrl} target="_blank" rel="noreferrer">
                <Button variant="ghost">
                  <ExternalLink className="h-4 w-4" /> Open
                </Button>
              </a>
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success("Link copied. Paste it in the group chat.");
                  } catch {
                    toast.error("Copy failed. Select the link and copy it.");
                  }
                }}
              >
                <Copy className="h-4 w-4" /> Copy link
              </Button>
            </>
          }
        >
          <Input
            value={shareUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
            className="font-mono text-[12px]"
          />
          <p className="text-muted mt-3 text-[11px]">
            Players see nicknames and levels only, never full names, contacts, or fees. They can type their
            nickname to see if they are next.
          </p>
        </Modal>

        {/* Rename court modal */}
        <Modal
          open={Boolean(renameTarget)}
          onClose={() => setRenameTarget(null)}
          title={`Rename ${renameTarget?.name ?? "court"}`}
          description="Use the number the venue assigned. Type 5 to show “Court 5”, or any name like “Main court”."
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  renameTarget &&
                  act(
                    () =>
                      renameCourt(
                        data.gameDay.id,
                        slotIndex,
                        renameTarget.court,
                        renameLabel,
                        plan.length > 1 && renameEveryBlock,
                      ),
                    () => setRenameTarget(null),
                  )
                }
                loading={pending}
              >
                <Check className="h-4 w-4" /> Save name
              </Button>
            </>
          }
        >
          <Field label="Court number or name" hint="Leave blank to show its position number.">
            <Input
              value={renameLabel}
              onChange={(event) => setRenameLabel(event.target.value)}
              maxLength={24}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
            />
          </Field>
          {plan.length > 1 && (
            <label className="text-ink-soft mt-3 flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={renameEveryBlock}
                onChange={(event) => setRenameEveryBlock(event.target.checked)}
                className="accent-forest h-4 w-4"
              />
              Use this name in every block
            </label>
          )}
        </Modal>

        {/* Add court modal */}
        <Modal
          open={addCourtOpen}
          onClose={() => setAddCourtOpen(false)}
          title="Add a court"
          description={slot ? `Adds one court to ${slot.label} (${slot.start}–${slot.end}).` : undefined}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setAddCourtOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  act(
                    () => addCourt(data.gameDay.id, slotIndex, newCourtLabel),
                    () => setAddCourtOpen(false),
                  )
                }
                loading={pending}
              >
                <Plus className="h-4 w-4" /> Add court
              </Button>
            </>
          }
        >
          <Field label="Court name" hint="Optional. Leave blank to number it after the others.">
            <Input
              value={newCourtLabel}
              onChange={(event) => setNewCourtLabel(event.target.value)}
              placeholder={slot ? `Court ${slot.courts + 1}` : "Court"}
              maxLength={24}
            />
          </Field>
          <p className="text-muted mt-3 text-[11px]">
            The first game in Next up moves onto the new court. Remove courts in Settings.
          </p>
        </Modal>

        {/* Edit match modal */}
        <Modal
          open={Boolean(editMatch)}
          onClose={() => setEditMatch(null)}
          title={`Edit ${editMatch ? courtName(slot, editMatch.courtNumber) : ""}`}
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
                  {editMatch.courtNumber === QUEUED_COURT && (
                    <option value={QUEUED_COURT}>Next up (no court yet)</option>
                  )}
                  {Array.from(
                    { length: Math.max(1, data.stats.courtsTotal || 1) },
                    (_, index) => index + 1,
                  ).map((court) => (
                    <option key={court} value={court}>
                      {courtName(slot, court)}
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
                      team.tone === "forest"
                        ? "border-forest/20 bg-forest/[0.03]"
                        : "border-line bg-cream/30",
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
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <DragChip
            drag={activeDrag}
            courtLabel={activeDrag.kind === "match" ? courtName(slot, activeDrag.courtNumber) : undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function FreeTag() {
  return (
    <span
      title="Free game — used shuttle, not counted"
      className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold tracking-wider text-violet-900 uppercase"
    >
      <Gift className="h-2.5 w-2.5" /> Free
    </span>
  );
}

/**
 * Waiting courts flip the gold and ink tokens for their yellow surface, so their
 * buttons use fixed colours instead of the accent variant: black with gold text.
 */
const WAITING_BUTTON = "!bg-[#0a0a0a] !text-[#ffd600] hover:!bg-[#2a2a2a]";

/** A court's name; tap it to rename the court when renaming is allowed. */
function CourtNameButton({ name, onRename }: { name: string; onRename?: () => void }) {
  if (!onRename) return <>{name}</>;
  return (
    <button
      type="button"
      onClick={onRename}
      title={`Rename ${name}`}
      aria-label={`Rename ${name}`}
      className="group/name hover:text-cream inline-flex items-center gap-1 rounded uppercase underline decoration-dotted decoration-1 underline-offset-4 transition"
    >
      {name}
      <Pencil className="h-2.5 w-2.5 opacity-50 group-hover/name:opacity-100" />
    </button>
  );
}

function RemoveCourtButton({
  name,
  live,
  pending,
  onRemove,
}: {
  name: string;
  live: boolean;
  pending: boolean;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={pending || live}
      aria-label={`Remove ${name}`}
      title={live ? "Finish or cancel the game in progress before removing this court" : `Remove ${name}`}
      className="border-cream/20 text-cream/50 hover:border-coral/60 hover:bg-coral/20 hover:text-cream grid h-6 w-6 place-items-center rounded-full border transition disabled:opacity-30"
    >
      <Minus className="h-3 w-3" />
    </button>
  );
}

function CourtCard({
  court,
  name,
  match,
  draft,
  playerById,
  now,
  pending,
  isCompleted,
  onPair,
  onStart,
  onRegenerate,
  onMoveUp,
  onMoveDown,
  onFinish,
  onEdit,
  onCancel,
  onClearDraft,
  queuePosition,
  canStart = true,
  onRemove,
  onRename,
}: {
  court: number;
  name: string;
  match?: BoardMatch;
  draft: Array<string | null>;
  playerById: Map<string, BoardPlayer>;
  now: number;
  pending: boolean;
  isCompleted: boolean;
  onPair: () => void;
  onStart: (id: string) => void;
  /** Swaps this suggested game for a different arrangement. */
  onRegenerate: (id: string) => void;
  /** Waiting games only: move this game up or down the line. Absent at the ends. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onFinish: (match: BoardMatch) => void;
  onEdit: (match: BoardMatch) => void;
  onCancel: (id: string) => void;
  onClearDraft: (index: number) => void;
  /** Place in the Next up line when this card is a waiting court holding a game. */
  queuePosition?: number;
  /** False when a waiting court's game has no free court to start on. */
  canStart?: boolean;
  /** Removes this court from the block (real courts only). */
  onRemove?: () => void;
  /** Opens the rename dialog (real courts only). */
  onRename?: () => void;
}) {
  // A waiting court (court 0) holds a game ahead of time; it is not a real court.
  const waiting = court === QUEUED_COURT;
  const { setNodeRef: setCourtRef, isOver: courtOver } = useDroppable({
    id: waiting ? `waiting-${match?.id ?? "new"}` : `court-${court}`,
    data: { kind: "court", courtNumber: court, matchId: match?.id } satisfies DropTarget,
    disabled: isCompleted,
  });
  const mounted = useMounted();
  const {
    setNodeRef: setHandleRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: `match-${match?.id ?? `open-${court}`}`,
    data: { kind: "match", matchId: match?.id ?? "", courtNumber: court } satisfies DragPayload,
    disabled: !match || isCompleted,
  });

  if (!match) {
    return (
      <div
        ref={setCourtRef}
        className={cn(
          "court-surface relative overflow-hidden rounded-2xl border-2 border-dashed transition",
          waiting && "court-surface-waiting",
          isCompleted ? "opacity-60" : waiting ? "border-cream/30" : "border-cream/20",
          courtOver && "border-lime ring-lime/40 ring-2",
        )}
      >
        <CourtLines tone={waiting ? "waiting" : "open"} />
        <div className="relative p-3">
          <div className="flex items-center justify-between">
            <span className="text-cream/70 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.16em] uppercase">
              <span className="bg-cream/40 h-1.5 w-1.5 rounded-full" />
              <CourtNameButton name={name} onRename={isCompleted ? undefined : onRename} />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="border-cream/25 bg-cream/10 text-cream/60 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                Open
              </span>
              {onRemove && !isCompleted && (
                <RemoveCourtButton name={name} live={false} pending={pending} onRemove={onRemove} />
              )}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-8">
            {[
              [0, 1],
              [2, 3],
            ].map((column) => (
              <div key={column[0]} className="space-y-1.5">
                {column.map((index) => (
                  <DraftSlot
                    key={index}
                    court={court}
                    index={index}
                    player={draft[index] ? playerById.get(draft[index]!) : undefined}
                    onClear={onClearDraft}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="text-cream/40 text-[10px]">
              {draft.some(Boolean)
                ? `Pair fills the other ${draft.filter((id) => !id).length}`
                : waiting
                  ? "Drop players, or Pair for all four"
                  : "Drop waiting players, or Pair for all four"}
            </span>
            <Button
              variant="accent"
              size="sm"
              onClick={onPair}
              disabled={pending || isCompleted}
              className={cn("h-8", waiting && WAITING_BUTTON)}
            >
              <Wand2 className="h-3.5 w-3.5" /> {draft.some(Boolean) ? "Fill the rest" : "Pair"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const live = match.status === "LIVE";
  const elapsed =
    match.startedAt && now ? Math.max(0, Math.floor((now - Date.parse(match.startedAt)) / 1000)) : 0;
  const balance = Math.abs(teamValue(match.team1) - teamValue(match.team2));

  return (
    <div
      ref={setCourtRef}
      className={cn(
        "court-surface animate-pop-in relative overflow-hidden rounded-2xl border transition",
        waiting && "court-surface-waiting",
        live ? "border-lime/45 shadow-gold" : waiting ? "border-lime/30 border-dashed" : "border-lime/20",
        courtOver && "border-lime ring-lime/50 ring-2",
        isDragging && "opacity-60",
      )}
    >
      <CourtLines tone={live ? "live" : waiting ? "waiting" : "suggested"} />
      <div className="relative p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span
              ref={setHandleRef}
              {...listeners}
              {...(mounted ? attributes : {})}
              aria-label={waiting ? `Drag ${name} onto a free court` : `Move the ${name} match`}
              className={cn(
                "text-cream/45 hover:text-cream grid h-6 w-5 cursor-grab touch-none place-items-center rounded",
                isDragging && "text-lime",
              )}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
            <span className="text-cream/75 truncate font-mono text-[10px] font-bold tracking-[0.16em] uppercase">
              <CourtNameButton name={name} onRename={isCompleted ? undefined : onRename} />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {live && (
              <span className="border-lime/30 bg-forest-deep/60 text-lime inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold">
                <span className="animate-live-ring bg-lime text-lime h-1.5 w-1.5 rounded-full" />
                {formatDuration(elapsed)}
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase",
                live || queuePosition === 1
                  ? "bg-lime text-forest-deep"
                  : "border-lime/40 bg-lime/10 text-lime border",
              )}
            >
              {live ? "Live" : waiting ? (queuePosition === 1 ? "Up next" : "Waiting") : "Suggested"}
            </span>
            {match.free && <FreeTag />}
            {waiting && !isCompleted && (onMoveUp || onMoveDown) && (
              <span className="flex items-center">
                <button
                  type="button"
                  onClick={onMoveUp}
                  disabled={!onMoveUp || pending}
                  aria-label={`Move ${name} up the line`}
                  title="Earlier in line"
                  className="text-cream/70 hover:text-cream hover:bg-cream/10 grid h-6 w-6 place-items-center rounded-full disabled:opacity-25"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onMoveDown}
                  disabled={!onMoveDown || pending}
                  aria-label={`Move ${name} down the line`}
                  title="Later in line"
                  className="text-cream/70 hover:text-cream hover:bg-cream/10 grid h-6 w-6 place-items-center rounded-full disabled:opacity-25"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {onRemove && !isCompleted && (
              <RemoveCourtButton name={name} live={live} pending={pending} onRemove={onRemove} />
            )}
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-x-8">
          <div className="space-y-1.5">
            {match.team1.map((player) => (
              <PlayerChip
                key={player.playerId}
                matchId={match.id}
                team={1}
                player={player}
                disabled={isCompleted}
              />
            ))}
          </div>
          <div className="space-y-1.5">
            {match.team2.map((player) => (
              <PlayerChip
                key={player.playerId}
                matchId={match.id}
                team={2}
                player={player}
                disabled={isCompleted}
              />
            ))}
          </div>
        </div>

        <div className="border-cream/15 mt-2 flex items-center justify-between gap-2 border-t pt-1.5">
          <span className="text-cream/50 inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.1em] uppercase">
            <Zap className="text-lime/70 h-3 w-3" />
            {balance === 0 ? "Level teams" : `${balance} level gap`}
          </span>
          <span className="text-cream/40 font-mono text-[9px]">R{match.round}</span>
        </div>

        <div className="mt-1.5 flex items-center gap-1.5">
          {live ? (
            <Button
              variant="accent"
              size="sm"
              onClick={() => onFinish(match)}
              disabled={pending}
              className="h-8 flex-1"
            >
              <Flag className="h-3.5 w-3.5" /> Finish
            </Button>
          ) : (
            <Button
              variant="accent"
              size="sm"
              onClick={() => onStart(match.id)}
              disabled={pending || isCompleted || !canStart}
              title={
                canStart ? undefined : "Every court is in use — this game takes the next one that frees up"
              }
              className={cn("h-8 flex-1", waiting && WAITING_BUTTON)}
            >
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          {!live && (
            <button
              type="button"
              onClick={() => onRegenerate(match.id)}
              disabled={pending || isCompleted}
              aria-label="Regenerate this pairing"
              title="Different pairing"
              className="border-cream/20 bg-cream/10 text-cream/80 hover:bg-cream/20 press grid h-8 w-8 place-items-center rounded-full border disabled:opacity-40"
            >
              <Shuffle className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(match)}
            disabled={pending}
            aria-label="Edit match"
            className="border-cream/20 bg-cream/10 text-cream/80 hover:bg-cream/20 press grid h-8 w-8 place-items-center rounded-full border disabled:opacity-40"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onCancel(match.id)}
            disabled={pending}
            aria-label="Cancel match"
            className="border-cream/15 text-cream/50 hover:text-coral grid h-8 w-8 place-items-center rounded-full border border-transparent transition disabled:opacity-40"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerChip({
  matchId,
  team,
  player,
  disabled,
}: {
  matchId: string;
  team: number;
  player: BoardMatch["team1"][number];
  disabled: boolean;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot-${matchId}-${team}-${player.slot}`,
    data: {
      kind: "slot",
      matchId,
      team,
      slot: player.slot,
      playerId: player.playerId,
    } satisfies DropTarget,
    disabled,
  });
  const mounted = useMounted();
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: `mp-${matchId}-${player.playerId}`,
    data: {
      kind: "match-player",
      matchId,
      playerId: player.playerId,
      team,
      slot: player.slot,
      nickname: player.nickname,
      level: player.level,
    } satisfies DragPayload,
    disabled,
  });

  return (
    <div
      ref={setDropRef}
      className={cn(
        "rounded-lg border transition",
        isOver ? "border-lime bg-lime/15 ring-lime/50 ring-2" : "border-cream/30 bg-forest-deep/35",
        isDragging && "opacity-40",
      )}
    >
      <div
        ref={setDragRef}
        {...listeners}
        {...(mounted ? attributes : {})}
        className="flex cursor-grab touch-none items-center gap-1.5 px-1.5 py-1"
      >
        <Avatar name={player.nickname} size="sm" className="h-6 w-6 text-[9px]" />
        <div className="min-w-0 flex-1">
          <p className="text-cream truncate text-[11px] leading-tight font-semibold">{player.nickname}</p>
          <p className="text-lime/70 font-mono text-[8px] leading-tight font-bold">
            {levelLabel(player.level)}
          </p>
        </div>
        <GripVertical className="text-cream/25 h-3 w-3 shrink-0" />
      </div>
    </div>
  );
}

function DraftSlot({
  court,
  index,
  player,
  onClear,
}: {
  court: number;
  index: number;
  player?: BoardPlayer;
  onClear: (index: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `draft-${court}-${index}`,
    data: { kind: "draft-slot", courtNumber: court, index } satisfies DropTarget,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-[40px] items-center justify-center rounded-lg border border-dashed text-[10px] transition",
        isOver ? "border-lime bg-lime/15 text-lime" : "border-cream/25 bg-forest-deep/20 text-cream/40",
      )}
    >
      {player ? (
        <button
          type="button"
          onClick={() => onClear(index)}
          className="flex w-full items-center gap-1.5 px-1.5 text-left"
        >
          <span className="text-cream truncate text-[11px] font-semibold">{player.nickname}</span>
          <span className="text-lime/70 ml-auto font-mono text-[9px] font-bold">
            {levelLabel(player.level)}
          </span>
          <XCircle className="text-cream/40 h-3 w-3 shrink-0" />
        </button>
      ) : (
        <span>{isOver ? "Drop player" : `Team ${index < 2 ? "A" : "B"} · ${(index % 2) + 1}`}</span>
      )}
    </div>
  );
}

function DragChip({ drag, courtLabel }: { drag: DragPayload; courtLabel?: string }) {
  if (drag.kind === "match") {
    return (
      <div className="border-lime/50 bg-forest-deep text-cream shadow-float inline-flex rotate-2 items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold">
        <GripVertical className="text-lime h-3.5 w-3.5" /> {courtLabel ?? `Court ${drag.courtNumber}`}
      </div>
    );
  }
  return (
    <div className="border-lime/50 bg-forest-deep text-cream shadow-float inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
      <Avatar name={drag.nickname} size="sm" className="h-6 w-6 text-[9px]" />
      <span className="text-[12px] font-semibold">{drag.nickname}</span>
      <span className="text-lime/70 font-mono text-[9px] font-bold">{levelLabel(drag.level)}</span>
    </div>
  );
}

function QueueRow({
  player,
  draggable,
  now,
  pending,
  onCheckIn,
  onUndoCheckIn,
  onDone,
  onRequeue,
  onPriority,
}: {
  player: BoardPlayer;
  /** Waiting players can be dragged onto a court or waiting court; players on court only into a waiting court, to plan ahead. */
  draggable: boolean;
  now: number;
  pending: boolean;
  onCheckIn: () => void;
  onUndoCheckIn: () => void;
  onDone: () => void;
  onRequeue: () => void;
  onPriority: () => void;
}) {
  const wait = waitSeconds(player.queuedAt, now);
  const pairRequest = player.requests.find((request) => request.type === "PAIR_WITH");
  const againstRequest = player.requests.find((request) => request.type === "PLAY_AGAINST");
  const mounted = useMounted();
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `queue-${player.sessionPlayerId}`,
    data: {
      kind: "queue-player",
      playerId: player.playerId,
      nickname: player.nickname,
      level: player.level,
      status: player.status,
    } satisfies DragPayload,
    disabled: !draggable,
  });

  return (
    <div
      className={cn(
        "group hover:border-line hover:bg-cream/50 animate-pop-in flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 transition",
        player.priority && "border-lime-deep/30 bg-lime/[0.07]",
      )}
    >
      <div
        ref={setNodeRef}
        {...(draggable ? listeners : {})}
        {...(draggable && mounted ? attributes : {})}
        aria-label={draggable ? `Drag ${player.nickname} to a court` : undefined}
        title={
          draggable
            ? player.status === "PLAYING"
              ? "Still playing: drag into a waiting game to plan ahead"
              : "Drag onto a court or the waiting court"
            : undefined
        }
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-xl",
          draggable &&
            "border-forest/35 bg-paper hover:border-forest hover:bg-lime/15 cursor-grab touch-manipulation border-2 border-dashed py-1 pr-2 pl-1 shadow-sm transition select-none active:cursor-grabbing",
          isDragging && "border-lime bg-lime/20 opacity-50",
        )}
      >
        {draggable && <GripVertical className="text-forest/60 h-4 w-4 shrink-0" aria-hidden="true" />}
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
      </div>

      {player.status === "WAITING" && (
        <>
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-1 font-mono text-[10px] font-bold tabular-nums",
              wait < 5 * 60
                ? "bg-lime/30 text-forest-deep"
                : wait < 15 * 60
                  ? "bg-amber-100 text-amber-900"
                  : "bg-coral text-white",
            )}
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
                "text-muted hover:bg-cream-deep press grid h-7 w-7 place-items-center rounded-full",
                player.priority && "text-lime-deep",
              )}
              title={player.priority ? "Clear priority" : "Mark priority"}
            >
              <Star className={cn("h-3.5 w-3.5", player.priority && "fill-current")} />
            </button>
            {player.gamesPlayed === 0 && (
              <button
                type="button"
                onClick={onUndoCheckIn}
                disabled={pending}
                className="text-muted hover:bg-cream-deep hover:text-ink press grid h-7 w-7 place-items-center rounded-full"
                title="Undo check-in (checked in by mistake)"
                aria-label={`Undo check-in for ${player.nickname}`}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onDone}
              disabled={pending}
              className="text-muted hover:bg-cream-deep hover:text-ink press grid h-7 w-7 place-items-center rounded-full"
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

function railTone(warn: boolean | undefined) {
  // a stretched wait turns the number coral so the master notices
  return warn ? "text-coral" : undefined;
}

function RailCell({
  label,
  value,
  sub,
  subTrimId,
  warn,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subTrimId?: string;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("bg-paper px-4 py-3.5", className)}>
      <p className="text-muted text-[9px] font-bold tracking-[0.16em] uppercase">{label}</p>
      <p
        key={String(value)}
        className={cn(
          "font-display animate-pop-in mt-1.5 text-[1.65rem] leading-none font-bold tabular-nums",
          railTone(warn),
        )}
      >
        {value}
      </p>
      {sub && (
        <p data-trim-id={subTrimId} className="text-muted mt-1.5 text-[10px]">
          {sub}
        </p>
      )}
    </div>
  );
}
