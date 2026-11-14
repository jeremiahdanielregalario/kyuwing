"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import useSWR from "swr";
import {
  optimisticCancel,
  optimisticFinish,
  optimisticStart,
  optimisticStatus,
} from "@/lib/board-optimistic";
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
  type Modifier,
  pointerWithin,
} from "@dnd-kit/core";
import {
  Activity,
  AlertCircle,
  BadgeHelp,
  LogOut,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  Crosshair,
  Download,
  Flag,
  Gamepad2,
  GripVertical,
  HeartHandshake,
  LayoutGrid,
  ListOrdered,
  Link2,
  Pencil,
  Shuffle,
  ChevronUp,
  ChevronDown,
  PanelBottom,
  Undo2,
  Play,
  Plus,
  Gift,
  Minus,
  MoreVertical,
  AlarmClock,
  Search,
  Settings2,
  Share2,
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
  startGameDay,
  startAllSuggested,
  startMatch,
  swapMatchPlayers,
  togglePriority,
  updateMatchPlayers,
  addWalkIn,
} from "@/lib/actions/gamedays";
import type { BoardData, BoardMatch, BoardPlayer } from "@/lib/board-types";
import { CATEGORY_SHORT, GAMEDAY_TYPE_LABELS } from "@/lib/fees";
import { LEVEL_OPTIONS, isUnrated, levelLabel, levelTone, levelValue } from "@/lib/levels";
import {
  EMPTY_DRAFT,
  firstFreePlace,
  placeInDrafts,
  removeFromDrafts,
  type CourtDrafts,
} from "@/lib/court-drafts";
import { canDropOn, canTapOn, eventPoint, samePick } from "@/lib/drag-targets";
import { GAME_MINUTES, planTimeline } from "@/lib/planning";
import {
  courtName,
  formatClock,
  formatTimeRange,
  formatDuration,
  formatGameDate,
  minutesLeftInReservation,
  startTimeReached,
  offersFreeGame,
  QUEUED_COURT,
  reservationEnd,
  timeToMinutes,
} from "@/lib/datetime";
import { formatWaited, gamesToStart } from "@/lib/start-reminder";
import { CourtLines } from "@/components/app/court-surface";
import { Avatar } from "@/components/ui/avatar";
import { Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Modal } from "@/components/ui/modal";
import { SavingPill } from "@/components/ui/saving-pill";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { haptic } from "@/lib/haptics";
import type { ActionFailureCode } from "@/lib/action-result";
import { UnratedLevelsPrompt } from "@/components/app/unrated-levels-prompt";
import { ShareLiveDialog, useLiveLinkShared } from "@/components/app/share-live-dialog";
import { StartGameDayDialog } from "@/components/app/start-game-day-dialog";
import { cn } from "@/lib/utils";

type AnyResult = { ok: true; message?: string } | { ok: false; error: string; code?: ActionFailureCode };
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
/** Whether this device already closed the automatic start review for a game day. */
function reviewSeen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markReviewSeen(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Private mode: it stays closed until the page reloads.
  }
}

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
  | {
      kind: "queue-player";
      playerId: string;
      nickname: string;
      level: string;
      status: string;
      /** Set when the player is picked up from a hand-filled court place, not from the queue. */
      fromDraft?: { courtNumber: number; index: number };
    };

type DropTarget =
  | { kind: "court"; courtNumber: number; matchId?: string }
  | { kind: "slot"; matchId: string; team: number; slot: number; playerId: string }
  | { kind: "draft-slot"; courtNumber: number; index: number };

/**
 * Tap-to-move, the phone-friendly way to do what dragging does: tap a player or a court's grip
 * to pick it up, then tap a highlighted place to put it down. Drag and tap share `applyMove`.
 */
type TapMove = {
  picked: DragPayload | null;
  /** Picks the item up, or puts it back down when it is already picked. */
  pick: (item: DragPayload) => void;
  canTap: (target: DropTarget) => boolean;
  drop: (target: DropTarget) => void;
};

const TapMoveContext = React.createContext<TapMove>({
  picked: null,
  pick: () => {},
  canTap: () => false,
  drop: () => {},
});

/** Only offer a drag the targets it can land on (see `canDropOn`). */
/**
 * The drop target follows the pointer or finger: the slot under it, else the nearest valid one.
 * (The drag chip is small and sits above the finger on touch, so its own box is not used.)
 */
const collisionFor: CollisionDetection = (args) => {
  const scoped = {
    ...args,
    droppableContainers: args.droppableContainers.filter((container) =>
      canDropOn(
        args.active.data.current as DragPayload | undefined,
        container.data.current as DropTarget | undefined,
      ),
    ),
  };
  const point = args.pointerCoordinates;
  if (!point) return closestCenter(scoped);
  // Over the phone's queue panel there is nothing to drop on: letting go there cancels the drag.
  const panel = document.querySelector("[data-queue-panel]")?.getBoundingClientRect();
  if (panel && point.y >= panel.top && point.y <= panel.bottom) return [];
  const under = pointerWithin(scoped);
  if (under.length > 0) return under;
  return closestCenter({
    ...scoped,
    collisionRect: { top: point.y, left: point.x, bottom: point.y, right: point.x, width: 0, height: 0 },
  });
};

/** Moves the drag overlay's corner to the pointer; `DragChip` then centres itself on it. */
const overlayAtPointer: Modifier = ({ activatorEvent, activeNodeRect, transform }) => {
  const point = eventPoint(activatorEvent);
  if (!point || !activeNodeRect) return transform;
  return {
    ...transform,
    x: transform.x + point.x - activeNodeRect.left,
    y: transform.y + point.y - activeNodeRect.top,
  };
};

/** Phones and tablets below `lg`, where the queue is not a side column. */
const NARROW_QUERY = "(max-width: 1023.98px)";
function useNarrowScreen() {
  return React.useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(NARROW_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

/** Split screen on phones (courts above, queue panel below); on unless turned off on this device. */
const SPLIT_KEY = "kyuwing.board-split";
const splitListeners = new Set<() => void>();
function readSplit() {
  try {
    return window.localStorage.getItem(SPLIT_KEY) !== "off";
  } catch {
    return true;
  }
}
function useSplitPreference(): [boolean, (on: boolean) => void] {
  const on = React.useSyncExternalStore(
    (onChange) => {
      splitListeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        splitListeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    readSplit,
    () => true,
  );
  const set = (value: boolean) => {
    try {
      window.localStorage.setItem(SPLIT_KEY, value ? "on" : "off");
    } catch {
      // Private mode: the choice just isn't remembered.
    }
    splitListeners.forEach((listener) => listener());
  };
  return [on, set];
}

/** The split queue panel's height: a bit under half the space between the header and the nav. */
const QUEUE_PANEL_HEIGHT = "calc((100dvh - 8.25rem - env(safe-area-inset-bottom)) * 0.46)";
/** Dragging into this band just above the queue panel scrolls the courts down. */
const SCROLL_BAND = 64;

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

  // A server action that changes the board sends the redrawn page back with its answer, in the
  // same trip. Use that fresh board instead of asking the server again; polling stays as the
  // backstop. When the queue master is looking at another block, fetch that block once.
  const lastInitial = React.useRef(initialData);
  React.useEffect(() => {
    if (lastInitial.current === initialData) return;
    lastInitial.current = initialData;
    if (initialData.activeSlotIndex === slotIndex) void mutate(initialData, { revalidate: false });
    else void mutate();
  }, [initialData, slotIndex, mutate]);

  /** Show the result of a press right away; the server's answer replaces it a moment later. */
  const showNow = React.useCallback(
    (update: (current: BoardData) => BoardData) =>
      void mutate((current) => update(current ?? initialData), { revalidate: false }),
    [mutate, initialData],
  );
  const [pending, startTransition] = React.useTransition();

  const [tab, setTab] = React.useState<QueueTab>("waiting");
  const [query, setQuery] = React.useState("");
  const [checkOpen, setCheckOpen] = React.useState(false);
  const [checkQuery, setCheckQuery] = React.useState("");
  const [walkOpen, setWalkOpen] = React.useState(false);
  const [addCourtOpen, setAddCourtOpen] = React.useState(false);
  /** "Check the courts" pop-up shown when a draft game day is started. */
  const [startCourtsOpen, setStartCourtsOpen] = React.useState(false);
  /** The game day whose automatic start review was closed in this page load. */
  const [autoReviewed, setAutoReviewed] = React.useState<string | null>(null);
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
  const [drafts, setDrafts] = React.useState<CourtDrafts>({});
  const [activeDrag, setActiveDrag] = React.useState<DragPayload | null>(null);
  const [picked, setPicked] = React.useState<DragPayload | null>(null);
  React.useEffect(() => {
    if (!picked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicked(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked]);
  // Players still at level X (not rated yet). The prompt opens by itself until "Later" is
  // pressed for this exact group; a new X player, or a refused start, brings it back.
  const [unratedDismissed, setUnratedDismissed] = React.useState<string | null>(null);
  const [unratedForced, setUnratedForced] = React.useState(false);
  // Start reminder: games that just moved onto a court when another game ended, and games the
  // queue master answered "Not yet" for (they don't pop up again).
  const [promotedIds, setPromotedIds] = React.useState<string[]>([]);
  const [startLaterIds, setStartLaterIds] = React.useState<Set<string>>(() => new Set());
  const creatingDrafts = React.useRef<Set<number>>(new Set());
  // On touch the drag chip floats above the finger so the finger doesn't hide it.
  const [dragByTouch, setDragByTouch] = React.useState(false);
  const mounted = useMounted();
  const narrow = useNarrowScreen();
  const [splitPreferred, setSplitPreferred] = useSplitPreference();
  const [queueMinimized, setQueueMinimized] = React.useState(false);
  const [queueSearchOpen, setQueueSearchOpen] = React.useState(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold to pick up on a tablet, so a quick swipe still scrolls the queue.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const playerById = React.useMemo(
    () => new Map(data.players.map((player) => [player.playerId, player])),
    [data.players],
  );

  const act = (
    fn: () => Promise<AnyResult>,
    onSuccess?: () => void,
    optimistic?: (current: BoardData) => BoardData,
  ) => {
    if (optimistic) showNow(optimistic);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        haptic("success");
        toast.success(result.message ?? "Saved.");
        onSuccess?.();
      } else {
        // Undo the instant update by reloading what the server really has.
        if (optimistic) void mutate();
        haptic("warning");
        toast.error(result.error);
        if (result.code === "UNRATED_PLAYERS") setUnratedForced(true);
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

  const placeInDraft = (
    court: number,
    index: number,
    playerId: string,
    from?: { courtNumber: number; index: number },
  ) => {
    const all = placeInDrafts(drafts, court, index, playerId, from);
    const next = all[court];
    setDrafts(all);

    if (!next.every(Boolean) || creatingDrafts.current.has(court)) return;
    creatingDrafts.current.add(court);

    startTransition(async () => {
      const result = await createManualMatch(data.gameDay.id, court, next as string[]);
      if (result.ok) toast.success(result.message ?? "Court set.");
      else toast.error(result.error);
      creatingDrafts.current.delete(court);
      setDrafts((prev) => ({ ...prev, [court]: EMPTY_DRAFT }));
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    applyMove(
      event.active.data.current as DragPayload | undefined,
      event.over?.data.current as DropTarget | undefined,
    );
  };

  /** Puts a dragged or tapped item down on a target. */
  const applyMove = (active: DragPayload | undefined, over: DropTarget | undefined) => {
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
        placeInDraft(over.courtNumber, over.index, active.playerId, active.fromDraft);
        return;
      }
      if (over.kind === "court" && !over.matchId) {
        // Dropped on the court itself: the first free place, unless they are already on it.
        const current = drafts[over.courtNumber] ?? EMPTY_DRAFT;
        const empty = current.findIndex((id) => id === null);
        if (empty >= 0 && !current.includes(active.playerId)) {
          placeInDraft(over.courtNumber, empty, active.playerId, active.fromDraft);
        }
        return;
      }
      if (over.kind === "slot") {
        if (over.playerId === active.playerId) return;
        const match = data.activeMatches.find((item) => item.id === over.matchId);
        if (!match) return;
        const lineup = lineupOf(match);
        const next = over.team === 1 ? [...lineup.team1] : [...lineup.team2];
        next[over.slot - 1] = active.playerId;
        act(
          () =>
            over.team === 1
              ? updateMatchPlayers(match.id, next, lineup.team2)
              : updateMatchPlayers(match.id, lineup.team1, next),
          // They are in a game now, so they leave any court place they were dropped on.
          () => setDrafts((prev) => removeFromDrafts(prev, active.playerId)),
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
    setPicked(null);
    setDragByTouch(eventPoint(event.activatorEvent)?.touch ?? false);
    setActiveDrag((event.active.data.current as DragPayload | undefined) ?? null);
  };

  const plan = data.gameDay.courtPlan;
  const slot = plan[data.activeSlotIndex] ?? plan[0];

  // When the clock reaches the first court time and the game day is still a draft, the start
  // review opens by itself so the queue master checks everything and starts the day. Once closed
  // (or started) it stays closed on this device; Start game day still opens it any time.
  const reviewKey = `kyuwing:start-review:${data.gameDay.id}`;
  const autoReviewOpen =
    data.gameDay.status === "DRAFT" &&
    now > 0 &&
    autoReviewed !== data.gameDay.id &&
    startTimeReached(plan, data.gameDay.date, new Date(now)) &&
    !reviewSeen(reviewKey);
  const startReviewOpen = startCourtsOpen || autoReviewOpen;
  const closeStartReview = () => {
    markReviewSeen(reviewKey);
    setAutoReviewed(data.gameDay.id);
    setStartCourtsOpen(false);
  };
  const suggested = data.activeMatches.filter(
    (match) => match.status === "SUGGESTED" && match.courtNumber !== QUEUED_COURT,
  );
  // Next up line: paired games waiting for a court, oldest first (the board query orders by creation).
  const queued = data.activeMatches.filter((match) => match.courtNumber === QUEUED_COURT);
  const courtsFull = data.stats.courtsTotal > 0 && data.stats.courtsOpen === 0;

  const courtOfMatch = (matchId: string) =>
    data.activeMatches.find((match) => match.id === matchId)?.courtNumber;
  const tapMove: TapMove = {
    picked,
    pick: (item) => {
      if (isCompleted) return;
      haptic("tap");
      setPicked((current) => (samePick(current, item) ? null : item));
    },
    canTap: (target) => !isCompleted && !pending && canTapOn(picked, target, courtOfMatch),
    drop: (target) => {
      const item = picked;
      setPicked(null);
      applyMove(item ?? undefined, target);
    },
  };
  const pickedLabel = !picked
    ? ""
    : picked.kind === "match"
      ? courtName(slot, picked.courtNumber)
      : picked.nickname;

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
  const split = narrow && splitPreferred && !isCompleted;

  // Split screen: holding a dragged name just above the queue panel scrolls the courts down.
  // (dnd-kit's own auto-scroll covers the top edge; its bottom edge is under the panel.)
  React.useEffect(() => {
    if (!split || !activeDrag) return;
    // Read the finger straight from the events: dnd-kit's drag delta also counts page scrolling.
    let y: number | null = null;
    const track = (event: Event) => {
      y = eventPoint(event)?.y ?? y;
    };
    window.addEventListener("touchmove", track, { passive: true });
    window.addEventListener("mousemove", track, { passive: true });
    let frame = 0;
    const tick = () => {
      const panelTop = document.querySelector("[data-queue-panel]")?.getBoundingClientRect().top;
      if (y !== null && panelTop !== undefined && y < panelTop && y > panelTop - SCROLL_BAND) {
        // "instant": the page's smooth scrolling would restart every frame and crawl.
        window.scrollBy({ top: Math.ceil((y - (panelTop - SCROLL_BAND)) / 5), behavior: "instant" });
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("touchmove", track);
      window.removeEventListener("mousemove", track);
    };
  }, [split, activeDrag]);
  const unrated = data.players.filter((player) => isUnrated(player.level) && player.status !== "DONE");
  const unratedKey = unrated
    .map((player) => player.playerId)
    .sort()
    .join(",");
  const unratedOpen =
    !isCompleted && unrated.length > 0 && (unratedForced || unratedDismissed !== unratedKey);

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

  // Start reminder: a game on a court that hasn't started, either because it just moved up when
  // another game ended, or because it was paired a while ago and left. Queue masters often pair,
  // check the line-up, and forget to press Start.
  const startReminder = isCompleted
    ? []
    : gamesToStart(suggested, { now, movedIds: promotedIds, laterIds: startLaterIds });
  // Once the game day is live, remind the queue master to post the live link in the group chat
  // (until it has been copied, shared or downloaded on this device). Waits for other prompts.
  const [liveLinkShared, markLiveLinkShared] = useLiveLinkShared(data.gameDay.id);
  const [shareReminderLater, setShareReminderLater] = React.useState(false);
  const shareReminderOpen =
    data.gameDay.status === "LIVE" &&
    !liveLinkShared &&
    !shareReminderLater &&
    !shareOpen &&
    !confirmSpec &&
    !freePrompt &&
    !editMatch &&
    !unratedOpen &&
    !checkOpen &&
    !walkOpen &&
    !addCourtOpen &&
    !startReviewOpen &&
    !renameTarget &&
    !endPromptOpen;
  const startReminderOpen =
    startReminder.length > 0 &&
    !shareReminderOpen &&
    !confirmSpec &&
    !freePrompt &&
    !editMatch &&
    !unratedOpen &&
    !checkOpen &&
    !walkOpen &&
    !addCourtOpen &&
    !shareOpen &&
    !startReviewOpen &&
    !renameTarget &&
    !endPromptOpen;
  const startReminderMoved = startReminder.some((match) => promotedIds.includes(match.id));
  const startLater = () =>
    setStartLaterIds((prev) => new Set([...prev, ...startReminder.map((match) => match.id)]));

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
    showNow((current) => optimisticStart(current, matchId, free, new Date().toISOString()));
    startTransition(async () => {
      const result = await startMatch(matchId, { free });
      if (!result.ok) void mutate();
      if (result.ok) {
        haptic("success");
        toast.success(result.message ?? "Started.");
      } else if (result.code === "UNRATED_PLAYERS") {
        haptic("warning");
        toast.error(result.error);
        setUnratedForced(true);
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
    showNow((current) => optimisticStatus(current, sessionPlayerId, "EXPECTED", new Date().toISOString()));
    startTransition(async () => {
      const result = await undoCheckIn(sessionPlayerId);
      if (!result.ok) {
        void mutate();
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Check-in undone.", {
        duration: 8000,
        action: { label: "Check in again", onClick: () => act(() => checkInPlayer(sessionPlayerId)) },
      });
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
    promotionWatch.current = new Set(suggested.map((match) => match.id));
    showNow((current) => optimisticFinish(current, matchId, new Date().toISOString()));
    startTransition(async () => {
      const result = await completeMatch(matchId);
      if (!result.ok) {
        promotionWatch.current = null;
        void mutate();
        haptic("warning");
        toast.error(result.error);
        return;
      }
      haptic("success");
      toast.success(result.message ?? "Game ended.", {
        duration: 10000,
        action: { label: "Undo", onClick: () => act(() => restoreMatch(matchId)) },
      });
    });
  };

  // After a game ends, a waiting game that took the freed court still has to be started: remind
  // as soon as the server's board shows it.
  const promotionWatch = React.useRef<Set<string> | null>(null);
  React.useEffect(() => {
    const before = promotionWatch.current;
    if (!before) return;
    const moved = data.activeMatches.filter(
      (match) => match.status === "SUGGESTED" && match.courtNumber !== QUEUED_COURT && !before.has(match.id),
    );
    if (moved.length === 0) return;
    promotionWatch.current = null;
    setPromotedIds((prev) => [...prev, ...moved.map((match) => match.id)]);
  }, [data.activeMatches]);

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

  // The + on a queue block: the next free place, on the first open court, else the waiting court.
  const draftedIds = new Set(Object.values(drafts).flatMap((places) => places.filter(Boolean)));
  const pairedIds = new Set(
    data.activeMatches
      .filter((match) => match.status !== "LIVE")
      .flatMap((match) => [...match.team1, ...match.team2].map((row) => row.playerId)),
  );
  const quickAdd = (player: BoardPlayer) => {
    const openCourts = courtNumbers.filter(
      (court) => !data.activeMatches.some((match) => match.courtNumber === court),
    );
    // Someone still playing can only be planned into the waiting court.
    const place = firstFreePlace(
      drafts,
      player.status === "PLAYING" ? [QUEUED_COURT] : [...openCourts, QUEUED_COURT],
    );
    if (!place) {
      toast.error("No free place. Pair or clear a court first.");
      return;
    }
    haptic("tap");
    placeInDraft(place.court, place.index, player.playerId);
    toast(
      `${player.nickname} → ${place.court === QUEUED_COURT ? "Waiting court" : courtName(slot, place.court)}`,
      { duration: 1800 },
    );
  };

  // The queue's tabs, search and list: in the side card, or in the split-screen panel on phones.
  const queueTabs = (
    <>
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
          <span className={cn("ml-1 font-mono text-[9px]", tab === value ? "text-lime/80" : "text-muted/70")}>
            {tabCounts[value]}
          </span>
        </button>
      ))}
    </>
  );
  const queueSearch = (
    <>
      <Search className="text-muted pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find a player…"
        className="h-9 pl-8 text-[12px]"
      />
    </>
  );
  const queueList =
    visible.length === 0 ? (
      <div className="text-muted px-3 py-10 text-center text-[12px]">
        {query ? "No player matches that search." : `No players ${tab === "waiting" ? "waiting" : tab}.`}
      </div>
    ) : (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10.25rem,1fr))] gap-1.5">
        {visible.map((player) => (
          <QueueRow
            key={player.sessionPlayerId}
            // Not tied to `pending`: the blocks keep their outline and stay draggable while a move saves.
            draggable={(player.status === "WAITING" || player.status === "PLAYING") && !isCompleted}
            drafted={draftedIds.has(player.playerId)}
            onQuickAdd={isCompleted || pairedIds.has(player.playerId) ? undefined : () => quickAdd(player)}
            onReturn={() => setDrafts((prev) => removeFromDrafts(prev, player.playerId))}
            player={player}
            now={now}
            pending={pending}
            onCheckIn={() =>
              act(
                () => checkInPlayer(player.sessionPlayerId),
                undefined,
                (current) =>
                  optimisticStatus(current, player.sessionPlayerId, "WAITING", new Date().toISOString()),
              )
            }
            onUndoCheckIn={() => undoCheckInFor(player.sessionPlayerId)}
            onDone={() =>
              setConfirmSpec({
                title: `Mark ${player.nickname} done for the day?`,
                description: "They leave the board and stop receiving games.",
                confirmLabel: "Mark done",
                cancelLabel: "Not yet",
                onConfirm: () =>
                  act(
                    () => markPlayerDone(player.sessionPlayerId),
                    undefined,
                    (current) =>
                      optimisticStatus(current, player.sessionPlayerId, "DONE", new Date().toISOString()),
                  ),
              })
            }
            onRequeue={() =>
              act(
                () => requeuePlayer(player.sessionPlayerId),
                undefined,
                (current) =>
                  optimisticStatus(current, player.sessionPlayerId, "WAITING", new Date().toISOString()),
              )
            }
            onPriority={() => act(() => togglePriority(player.sessionPlayerId))}
          />
        ))}
      </div>
    );

  return (
    <TapMoveContext value={tapMove}>
      <SavingPill show={pending} />
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
                  {slot
                    ? `${formatTimeRange(slot.start, slot.end)} · ${slot.courts} courts`
                    : "No court block set"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  {isValidating ? "Syncing board…" : "Live on all devices"}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="accent" size="sm" onClick={() => setShareOpen(true)}>
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
                onClick={() =>
                  plan.length
                    ? setStartCourtsOpen(true)
                    : act(() => setGameDayStatus(data.gameDay.id, "LIVE"))
                }
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
                    <span className="font-mono">{formatTimeRange(row.start, row.end)}</span>
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
          <div
            className={cn(
              "glass border-line/60 bg-cream/80 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:-mx-6 sm:px-6 lg:sticky lg:top-0 lg:-mx-8 lg:px-8",
              // In split screen the courts need the height, so the bar scrolls away with the page.
              split ? "relative" : "sticky top-15",
            )}
          >
            <Button
              onClick={() => act(() => generateMatches(data.gameDay.id, slotIndex))}
              disabled={pending || isCompleted}
              className="basis-full sm:basis-auto"
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
            {!isCompleted && unrated.length > 0 && (
              <Button variant="paper" onClick={() => setUnratedForced(true)} className="flex-1 sm:flex-none">
                <BadgeHelp className="h-4 w-4" /> Set levels ({unrated.length})
              </Button>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_370px]">
            <div className="@container space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-display text-lg font-bold tracking-tight">Courts</h2>
                  <span data-trim-id="board.courts-block" className="text-muted text-[11px]">
                    {slot ? `Block ${formatTimeRange(slot.start, slot.end)}` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                  {narrow && !isCompleted && (
                    <Button
                      variant={split ? "dark" : "paper"}
                      size="sm"
                      onClick={() => {
                        setSplitPreferred(!split);
                        setQueueMinimized(false);
                      }}
                      aria-pressed={split}
                      title="Courts on top, the queue in a panel below, so names drag straight onto a court"
                    >
                      <PanelBottom className="h-3.5 w-3.5" /> Split screen
                    </Button>
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
                    Drag a court card onto another court to swap them. Drag a player block onto a place to
                    swap players, or fill an open court with four players (drag them in, or press +).
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
                              onConfirm: () =>
                                act(
                                  () => cancelMatch(id),
                                  undefined,
                                  (current) => optimisticCancel(current, id),
                                ),
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
                          frees up, in order. Add as many as you like, beyond the reserved courts. A player
                          can sit in several planned games but can&apos;t be on two playing courts at once.
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
                                  onConfirm: () =>
                                    act(
                                      () => cancelMatch(id),
                                      undefined,
                                      (current) => optimisticCancel(current, id),
                                    ),
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

            {split ? (
              <>
                {/* Room under the courts for the panel, so the last court can scroll above it. */}
                <div aria-hidden="true" style={{ height: queueMinimized ? "3.75rem" : QUEUE_PANEL_HEIGHT }} />
                {mounted &&
                  createPortal(
                    <section
                      data-queue-panel
                      data-trim-id="board.queue-panel"
                      aria-label="The queue"
                      style={{ height: queueMinimized ? undefined : QUEUE_PANEL_HEIGHT }}
                      className="border-line bg-paper fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex flex-col rounded-t-3xl border-t shadow-[0_-14px_32px_-20px_rgb(10_10_10/0.45)] lg:hidden"
                    >
                      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                        <div className="hide-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
                          {queueTabs}
                        </div>
                        {!queueMinimized && (
                          <button
                            type="button"
                            onClick={() => {
                              if (queueSearchOpen) setQuery("");
                              setQueueSearchOpen((value) => !value);
                            }}
                            className={cn(
                              "press grid h-9 w-9 shrink-0 place-items-center rounded-full",
                              queueSearchOpen || query
                                ? "bg-forest text-cream"
                                : "text-muted hover:bg-cream-deep hover:text-ink",
                            )}
                            aria-label={queueSearchOpen ? "Close search" : "Find a player"}
                            aria-pressed={queueSearchOpen}
                          >
                            <Search className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setQueueMinimized((value) => !value)}
                          className="press text-muted hover:bg-cream-deep hover:text-ink grid h-9 w-9 shrink-0 place-items-center rounded-full"
                          aria-label={queueMinimized ? "Show the queue" : "Hide the queue"}
                          aria-expanded={!queueMinimized}
                        >
                          {queueMinimized ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {!queueMinimized && (
                        <>
                          {(queueSearchOpen || query) && (
                            <div className="px-3 pb-2">
                              <div className="relative">{queueSearch}</div>
                            </div>
                          )}
                          <div className="border-line/70 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t px-2 py-1.5">
                            {queueList}
                          </div>
                        </>
                      )}
                    </section>,
                    document.body,
                  )}
              </>
            ) : (
              <Card className="h-fit lg:sticky lg:top-24">
                <div className="border-line/80 border-b px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold tracking-tight">The queue</h2>
                    <span className="bg-cream-deep text-ink-soft inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10px] font-bold">
                      <Users className="h-3 w-3" /> {data.players.length}
                    </span>
                  </div>
                  <div className="hide-scrollbar mt-3 flex gap-1 overflow-x-auto">{queueTabs}</div>
                  <div className="relative mt-3">{queueSearch}</div>
                </div>

                <div className="px-2 py-2 lg:max-h-[min(62vh,640px)] lg:overflow-y-auto">{queueList}</div>

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
            )}
          </div>

          <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />

          {/* Start reminder: paired games on a court that nobody has started yet. */}
          <Modal
            open={startReminderOpen}
            onClose={startLater}
            title={
              startReminder.length === 1
                ? `Start the game on ${courtName(slot, startReminder[0].courtNumber)}?`
                : `${startReminder.length} games haven't started`
            }
            description={
              startReminderMoved
                ? "The next game in line moved onto the free court. Its timer and game counts only begin once you press Start."
                : "These players were paired but the game was never started, so its timer and game counts haven't begun. Press Start once all four are on court."
            }
            size="sm"
            footer={
              <Button variant="ghost" onClick={startLater}>
                Not yet
              </Button>
            }
          >
            <div className="space-y-2">
              {startReminder.map((match) => {
                const waitedMinutes = now ? Math.floor((now - Date.parse(match.changedAt)) / 60000) : 0;
                return (
                  <div
                    key={match.id}
                    className="border-line bg-cream/70 flex items-center gap-3 rounded-xl border px-3.5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold">
                        {courtName(slot, match.courtNumber)}
                        {waitedMinutes >= 1 && (
                          <span className="text-muted font-normal">
                            {" "}
                            · paired {formatWaited(waitedMinutes)} ago
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[12px]">
                        {match.team1.map((player) => player.nickname).join(" & ")}
                        <span className="text-muted"> vs </span>
                        {match.team2.map((player) => player.nickname).join(" & ")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => requestStart(1, (free) => startGame(match.id, free))}
                      loading={pending}
                    >
                      <Play className="h-3.5 w-3.5" /> Start
                    </Button>
                  </div>
                );
              })}
            </div>
          </Modal>

          <UnratedLevelsPrompt
            open={unratedOpen}
            onClose={() => {
              setUnratedForced(false);
              setUnratedDismissed(unratedKey);
            }}
            gameDayId={data.gameDay.id}
            players={unrated}
            onSaved={() => {
              setUnratedForced(false);
              void mutate();
            }}
          />

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
                      onClick={() =>
                        act(
                          () => checkInPlayer(player.sessionPlayerId),
                          undefined,
                          (current) =>
                            optimisticStatus(
                              current,
                              player.sessionPlayerId,
                              "WAITING",
                              new Date().toISOString(),
                            ),
                        )
                      }
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
                    {LEVEL_OPTIONS.map((level) => (
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
              A free game is played with a used shuttle. It does not count as a game played, so it is not
              added to anyone&apos;s fees.
            </p>
          </Modal>

          {startReviewOpen && (
            <StartGameDayDialog
              plan={plan}
              gameDay={data.gameDay}
              players={data.players}
              pending={pending}
              onClose={closeStartReview}
              // Going to edit doesn't count as closing: back on the board, the review opens again.
              onEditDetails={() => router.push(`/app/gamedays/${data.gameDay.id}/settings`)}
              onEditPlayers={() => router.push(`/app/gamedays/${data.gameDay.id}/signups`)}
              onStart={(setup) => act(() => startGameDay(data.gameDay.id, setup), closeStartReview)}
            />
          )}

          {/* Share live view: opened from the header, or on its own as a reminder once the day is live */}
          <ShareLiveDialog
            open={shareOpen || shareReminderOpen}
            reminder={!shareOpen && shareReminderOpen}
            onClose={() => setShareOpen(false)}
            onLater={() => {
              setShareReminderLater(true);
              setShareOpen(false);
            }}
            onShared={() => {
              // Keep the dialog open (they may still want the QR code), just stop reminding.
              if (shareReminderOpen) setShareOpen(true);
              markLiveLinkShared();
            }}
            gameDay={data.gameDay}
            livePath={livePath}
          />

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
            description={
              slot ? `Adds one court to ${slot.label} (${formatTimeRange(slot.start, slot.end)}).` : undefined
            }
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
        {/* In a portal: the page wrapper keeps a transform from its entry animation, which would
            make the overlay's fixed position relative to it and put the chip far from the pointer. */}
        {mounted &&
          createPortal(
            <DragOverlay dropAnimation={null} modifiers={[overlayAtPointer]} className="pointer-events-none">
              {activeDrag ? (
                <DragChip
                  drag={activeDrag}
                  touch={dragByTouch}
                  courtLabel={
                    activeDrag.kind === "match" ? courtName(slot, activeDrag.courtNumber) : undefined
                  }
                />
              ) : null}
            </DragOverlay>,
            document.body,
          )}

        {picked &&
          !isCompleted &&
          createPortal(
            <div
              role="status"
              data-trim-id="board.tap-move"
              className={cn(
                "bg-ink text-paper shadow-float fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 lg:bottom-6",
                split ? "top-[4.25rem]" : "bottom-[calc(5rem+env(safe-area-inset-bottom))]",
              )}
            >
              <span className="bg-gold animate-pulse-soft h-2.5 w-2.5 shrink-0 rounded-full" />
              <p className="min-w-0 flex-1 text-[13px] leading-snug">
                Moving <span className="font-bold">{pickedLabel}</span>
                <span className="text-paper/70">
                  {" "}
                  · tap a highlighted {picked.kind === "match" ? "court" : "place"}
                </span>
              </p>
              <Button size="sm" variant="paper" onClick={() => setPicked(null)} className="h-9 shrink-0">
                Cancel
              </Button>
            </div>,
            document.body,
          )}
      </DndContext>
    </TapMoveContext>
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
  const payload: DragPayload = { kind: "match", matchId: match?.id ?? "", courtNumber: court };
  const {
    setNodeRef: setHandleRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: `match-${match?.id ?? `open-${court}`}`,
    data: payload,
    disabled: !match || isCompleted,
  });
  const tap = React.useContext(TapMoveContext);
  const courtTarget: DropTarget = { kind: "court", courtNumber: court, matchId: match?.id };
  // Only a picked game lands on the whole card; a picked player goes into a slot instead.
  const tapOverlay =
    tap.picked?.kind === "match" && match?.status !== "LIVE" && tap.canTap(courtTarget) ? (
      <button
        type="button"
        onClick={() => tap.drop(courtTarget)}
        className="bg-lime/20 absolute inset-0 z-10 grid place-items-center rounded-2xl backdrop-blur-[1px]"
      >
        <span className="bg-lime text-forest-deep shadow-float rounded-full px-4 py-2 text-[12px] font-bold">
          {waiting ? "Take this place in line" : match ? `Swap with ${name}` : `Move to ${name}`}
        </span>
      </button>
    ) : null;
  const isPicked = !!match && samePick(tap.picked, payload);

  if (!match) {
    return (
      <div
        ref={setCourtRef}
        className={cn(
          "court-surface relative overflow-hidden rounded-2xl border-2 border-dashed transition",
          waiting && "court-surface-waiting",
          isCompleted ? "opacity-60" : waiting ? "border-cream/30" : "border-cream/20",
          (courtOver || tapOverlay) && "border-lime ring-lime/40 ring-2",
        )}
      >
        {tapOverlay}
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
                    disabled={isCompleted}
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
                  ? "Tap or drag players in, or Pair for all four"
                  : "Tap or drag waiting players in, or Pair for all four"}
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
  const unstartedMinutes = !live && now ? Math.floor((now - Date.parse(match.changedAt)) / 60000) : 0;

  return (
    <div
      ref={setCourtRef}
      className={cn(
        "court-surface animate-pop-in relative overflow-hidden rounded-2xl border transition",
        waiting && "court-surface-waiting",
        live ? "border-lime/45 shadow-gold" : waiting ? "border-lime/30 border-dashed" : "border-lime/20",
        (courtOver || tapOverlay) && "border-lime ring-lime/50 ring-2",
        isPicked && "ring-gold ring-4",
        isDragging && "opacity-60",
      )}
    >
      {tapOverlay}
      <CourtLines tone={live ? "live" : waiting ? "waiting" : "suggested"} />
      <div className="relative p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span
              ref={setHandleRef}
              {...listeners}
              {...(mounted ? attributes : {})}
              onClick={() => !isCompleted && tap.pick(payload)}
              aria-pressed={mounted ? isPicked : undefined}
              aria-label={waiting ? `Move ${name} onto a free court` : `Move the ${name} match`}
              title="Tap, then tap another court (or drag)"
              className={cn(
                "text-cream/45 hover:text-cream -my-1.5 -ml-1.5 grid h-9 w-9 cursor-grab touch-manipulation place-items-center rounded-lg",
                (isDragging || isPicked) && "text-lime bg-lime/15",
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

        {!live && !waiting && !isCompleted && (
          <p
            data-trim-id="board.start-reminder"
            className="bg-gold text-ink relative mt-2 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug font-semibold"
          >
            Not started yet. Press Start once all four are on court
            {unstartedMinutes >= 1 ? ` · paired ${formatWaited(unstartedMinutes)} ago` : ""}.
            <span aria-hidden className="bg-gold absolute -bottom-1 left-8 h-2 w-2 rotate-45" />
          </p>
        )}

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
              className={cn(
                "h-8 flex-1",
                waiting
                  ? WAITING_BUTTON
                  : !isCompleted && "ring-gold ring-offset-forest-deep ring-2 ring-offset-2",
              )}
            >
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          {!live && (
            <button
              type="button"
              onClick={() => onRegenerate(match.id)}
              disabled={pending || isCompleted}
              title="Swap in a different set of four from the queue"
              className="border-cream/20 bg-cream/10 text-cream/90 hover:bg-cream/20 press inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] font-semibold disabled:opacity-40"
            >
              <Shuffle className="h-3.5 w-3.5" /> Re-pair
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(match)}
            disabled={pending}
            aria-label="Edit match"
            title="Edit players and teams"
            className="border-cream/20 bg-cream/10 text-cream/80 hover:bg-cream/20 press grid h-8 w-8 place-items-center rounded-full border disabled:opacity-40"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onCancel(match.id)}
            disabled={pending}
            aria-label="Cancel match"
            title="Cancel this match"
            className="border-coral/50 bg-coral/15 text-coral hover:bg-coral/25 press grid h-9 w-9 shrink-0 place-items-center rounded-full border transition disabled:opacity-40"
          >
            <XCircle className="h-5 w-5" />
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
  const target: DropTarget = { kind: "slot", matchId, team, slot: player.slot, playerId: player.playerId };
  const payload: DragPayload = {
    kind: "match-player",
    matchId,
    playerId: player.playerId,
    team,
    slot: player.slot,
    nickname: player.nickname,
    level: player.level,
  };
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot-${matchId}-${team}-${player.slot}`,
    data: target,
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
    data: payload,
    disabled,
  });
  const tap = React.useContext(TapMoveContext);
  const tappable = tap.canTap(target);
  const isPicked = samePick(tap.picked, payload);

  return (
    <div
      ref={setDropRef}
      className={cn(
        "bg-paper rounded-full border-2 shadow-sm transition",
        isOver || tappable
          ? "border-lime bg-lime/40 ring-lime/60 ring-2"
          : isPicked
            ? "border-gold bg-gold/40 ring-gold ring-2"
            : "border-cream/70",
        isDragging && "opacity-40",
      )}
    >
      <div
        ref={setDragRef}
        {...listeners}
        {...(mounted ? attributes : {})}
        onClick={() => (tappable ? tap.drop(target) : !disabled && tap.pick(payload))}
        aria-pressed={mounted ? isPicked : undefined}
        aria-label={
          tappable
            ? `Put ${tap.picked && "nickname" in tap.picked ? tap.picked.nickname : "player"} here, in place of ${player.nickname}`
            : `Move ${player.nickname}`
        }
        className={cn(BLOCK_GRAB, "flex h-8 items-center gap-1.5 pr-2 pl-1")}
      >
        <LevelDot level={player.level} />
        <p className="text-ink min-w-0 flex-1 truncate text-[12px] leading-tight font-semibold">
          {player.nickname}
        </p>
        <GripVertical className="text-ink/30 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}

function DraftSlot({
  court,
  index,
  player,
  disabled,
  onClear,
}: {
  court: number;
  index: number;
  player?: BoardPlayer;
  disabled: boolean;
  onClear: (index: number) => void;
}) {
  const target: DropTarget = { kind: "draft-slot", courtNumber: court, index };
  const { setNodeRef, isOver } = useDroppable({ id: `draft-${court}-${index}`, data: target, disabled });
  // A player dropped here is still a block: drag or tap them to another place, court or game.
  const payload: DragPayload = {
    kind: "queue-player",
    playerId: player?.playerId ?? "",
    nickname: player?.nickname ?? "",
    level: player?.level ?? "X",
    status: player?.status ?? "WAITING",
    fromDraft: { courtNumber: court, index },
  };
  const mounted = useMounted();
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: `draft-player-${court}-${index}`,
    data: payload,
    disabled: !player || disabled,
  });
  const tap = React.useContext(TapMoveContext);
  const isPicked = !!player && samePick(tap.picked, payload);
  const tappable = !isPicked && tap.canTap(target);

  if (!player) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex h-9 items-center justify-center rounded-full border-2 border-dashed text-[10px] transition",
          isOver || tappable
            ? "border-lime bg-lime/15 text-lime ring-lime/50 ring-2"
            : "border-cream/30 bg-forest-deep/20 text-cream/45",
        )}
      >
        {tappable ? (
          <button type="button" onClick={() => tap.drop(target)} className="h-full w-full font-semibold">
            Tap to put here
          </button>
        ) : (
          <span>{isOver ? "Drop player" : `Team ${index < 2 ? "A" : "B"} · ${(index % 2) + 1}`}</span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-paper flex h-9 items-center rounded-full border-2 shadow-sm transition",
        isOver || tappable
          ? "border-lime bg-lime/40 ring-lime/60 ring-2"
          : isPicked
            ? "border-gold bg-gold/40 ring-gold ring-2"
            : "border-gold/80",
        isDragging && "opacity-40",
      )}
    >
      <div
        ref={setDragRef}
        {...listeners}
        {...(mounted ? attributes : {})}
        onClick={() => (tappable ? tap.drop(target) : !disabled && tap.pick(payload))}
        aria-pressed={mounted ? isPicked : undefined}
        aria-label={
          tappable
            ? `Put ${tap.picked && "nickname" in tap.picked ? tap.picked.nickname : "player"} here, in place of ${player.nickname}`
            : `Move ${player.nickname}`
        }
        className={cn(BLOCK_GRAB, "flex h-full min-w-0 flex-1 items-center gap-1.5 pl-1")}
      >
        <LevelDot level={player.level} />
        <p className="text-ink min-w-0 flex-1 truncate text-[12px] leading-tight font-semibold">
          {player.nickname}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onClear(index)}
        disabled={disabled}
        aria-label={`Take ${player.nickname} off this court`}
        title="Back to the queue"
        className="text-ink/45 hover:text-coral grid h-full w-8 shrink-0 place-items-center rounded-full"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
}

/** The chip under the pointer while dragging: centred on a mouse, just above a finger. */
function DragChip({ drag, courtLabel, touch }: { drag: DragPayload; courtLabel?: string; touch: boolean }) {
  const place = cn(
    "absolute top-0 left-0 -translate-x-1/2 whitespace-nowrap",
    touch ? "-translate-y-[calc(100%+18px)]" : "-translate-y-1/2",
  );
  if (drag.kind === "match") {
    return (
      <div className={place}>
        <div className="border-lime/50 bg-forest-deep text-cream shadow-float inline-flex rotate-2 items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold">
          <GripVertical className="text-lime h-3.5 w-3.5" /> {courtLabel ?? `Court ${drag.courtNumber}`}
        </div>
      </div>
    );
  }
  return (
    <div className={place}>
      <div className="border-gold bg-paper text-ink shadow-float inline-flex h-9 items-center gap-1.5 rounded-full border-2 pr-3.5 pl-1">
        <LevelDot level={drag.level} />
        <span className="text-[13px] font-semibold">{drag.nickname}</span>
      </div>
    </div>
  );
}

/** Shared feel of every draggable player block: grab cursor, no text selection or long-press menu. */
const BLOCK_GRAB =
  "cursor-grab touch-manipulation rounded-full select-none [-webkit-touch-callout:none] active:cursor-grabbing";

/** The round level tag at the start of a player block, coloured by bracket. */
function LevelDot({ level, className }: { level: string; className?: string }) {
  const tone = levelTone(level);
  return (
    <span
      className={cn(
        "grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1 font-mono text-[9px] leading-none font-bold ring-1 ring-inset",
        tone.bg,
        tone.text,
        tone.ring,
        className,
      )}
    >
      {levelLabel(level)}
    </span>
  );
}

type BlockMenuItem = { label: string; icon: React.ReactNode; onSelect: () => void };

/** The ⋮ on a queue block. Opens next to the button, outside the scrolling list so it isn't cut off. */
function BlockMenu({ label, items, disabled }: { label: string; items: BlockMenuItem[]; disabled: boolean }) {
  const [place, setPlace] = React.useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!place) return;
    const close = (event: Event) => {
      const node = event.target as Node | null;
      if (node && (menuRef.current?.contains(node) || buttonRef.current?.contains(node))) return;
      setPlace(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlace(null);
    };
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [place]);

  const toggle = () => {
    if (place) {
      setPlace(null);
      return;
    }
    const box = buttonRef.current?.getBoundingClientRect();
    if (!box) return;
    const right = Math.max(8, window.innerWidth - box.right);
    // Open downwards unless the button is near the bottom of the screen.
    setPlace(
      window.innerHeight - box.bottom < items.length * 44 + 24
        ? { bottom: window.innerHeight - box.top + 4, right }
        : { top: box.bottom + 4, right },
    );
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!place}
        className="text-muted hover:bg-cream-deep hover:text-ink press grid h-9 w-6 shrink-0 place-items-center rounded-full"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {place &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={place}
            className="border-line bg-paper shadow-float animate-pop-in fixed z-[90] min-w-44 rounded-2xl border p-1"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPlace(null);
                  item.onSelect();
                }}
                className="text-ink hover:bg-cream-deep flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13px] font-semibold"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * A player block in the queue: level, name, games and waiting time in one compact pill. The pill
 * is the drag handle; + drops the player into the next free court place, ⋮ holds the rest.
 */
function QueueRow({
  player,
  draggable,
  drafted,
  now,
  pending,
  onQuickAdd,
  onReturn,
  onCheckIn,
  onUndoCheckIn,
  onDone,
  onRequeue,
  onPriority,
}: {
  player: BoardPlayer;
  /** Waiting players can be dragged onto a court or waiting court; players on court only into a waiting court, to plan ahead. */
  draggable: boolean;
  /** Already dropped into a court place that is still being filled by hand. */
  drafted: boolean;
  now: number;
  pending: boolean;
  /** Puts the player in the next free court place. Absent when they are already in a paired game. */
  onQuickAdd?: () => void;
  /** Takes the player back out of the court place they were dropped on. */
  onReturn: () => void;
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
  const payload: DragPayload = {
    kind: "queue-player",
    playerId: player.playerId,
    nickname: player.nickname,
    level: player.level,
    status: player.status,
  };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `queue-${player.sessionPlayerId}`,
    data: payload,
    disabled: !draggable,
  });
  const tap = React.useContext(TapMoveContext);
  const isPicked = draggable && samePick(tap.picked, payload);

  const menu: BlockMenuItem[] = [
    {
      label: player.priority ? "Clear priority" : "Mark priority",
      icon: <Star className={cn("h-4 w-4", player.priority && "fill-lime-deep text-lime-deep")} />,
      onSelect: onPriority,
    },
    ...(player.gamesPlayed === 0
      ? [{ label: "Undo check-in", icon: <Undo2 className="h-4 w-4" />, onSelect: onUndoCheckIn }]
      : []),
    { label: "Done for the day", icon: <Check className="h-4 w-4" />, onSelect: onDone },
  ];

  return (
    <div
      className={cn(
        "bg-paper animate-pop-in flex h-11 min-w-0 items-center rounded-full border-2 pr-1 shadow-sm transition",
        draggable ? "border-forest/30 hover:border-forest/60" : "border-line",
        player.priority && "border-lime-deep/60 bg-lime/10",
        drafted && "border-gold bg-gold/25",
        isDragging && "opacity-50",
        isPicked && "border-gold bg-gold/30 ring-gold ring-2",
      )}
    >
      <div
        ref={setNodeRef}
        {...(draggable ? listeners : {})}
        {...(draggable && mounted ? attributes : {})}
        onClick={draggable ? () => tap.pick(payload) : undefined}
        aria-pressed={draggable && mounted ? isPicked : undefined}
        aria-label={draggable ? `Move ${player.nickname} to a court` : undefined}
        title={
          draggable
            ? player.status === "PLAYING"
              ? "Still playing: tap or drag into a waiting game to plan ahead"
              : "Tap, then tap a court place (or drag)"
            : undefined
        }
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-full pr-1 pl-1.5",
          draggable && BLOCK_GRAB,
        )}
      >
        <LevelDot level={player.level} className="h-7 min-w-7 text-[10px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-[12px] leading-tight font-semibold">{player.nickname}</p>
            {player.priority && <Star className="fill-lime-deep text-lime-deep h-3 w-3 shrink-0" />}
          </div>
          <div className="text-muted flex items-center gap-1.5 overflow-hidden text-[10px] leading-tight whitespace-nowrap">
            <span
              className="inline-flex shrink-0 items-center gap-0.5 font-mono font-bold"
              title={`${player.gamesPlayed} ${player.gamesPlayed === 1 ? "game" : "games"} played`}
            >
              {player.gamesPlayed}
              <Gamepad2 className="h-3 w-3" aria-hidden="true" />
            </span>
            {player.status === "WAITING" && (
              <span
                className={cn(
                  "shrink-0 font-mono font-bold tabular-nums",
                  wait < 5 * 60 ? "text-forest" : wait < 15 * 60 ? "text-amber-700" : "text-coral",
                )}
                title="Waiting time"
              >
                {formatDuration(wait)}
              </span>
            )}
            {player.permanentPartnerNickname && (
              <span
                className="text-forest inline-flex min-w-0 items-center gap-0.5"
                title={`Permanent pair: ${player.permanentPartnerNickname}`}
              >
                <Link2 className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{player.permanentPartnerNickname}</span>
              </span>
            )}
            {pairRequest && (
              <span
                className="text-forest inline-flex min-w-0 items-center gap-0.5"
                title={`Wants to partner with ${pairRequest.targetNickname}`}
              >
                <HeartHandshake className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{pairRequest.targetNickname}</span>
              </span>
            )}
            {againstRequest && (
              <span
                className="text-coral inline-flex min-w-0 items-center gap-0.5"
                title={`Wants to play against ${againstRequest.targetNickname}`}
              >
                <Crosshair className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{againstRequest.targetNickname}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {draggable &&
        (drafted ? (
          <button
            type="button"
            onClick={onReturn}
            aria-label={`Take ${player.nickname} back off the court`}
            title="Back to the queue"
            className="border-gold bg-gold/40 text-ink press grid h-8 w-8 shrink-0 place-items-center rounded-full border"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        ) : (
          onQuickAdd && (
            <button
              type="button"
              onClick={onQuickAdd}
              aria-label={`Put ${player.nickname} in the next free court place`}
              title={
                player.status === "PLAYING" ? "Plan into the waiting court" : "Put in the next free place"
              }
              className="border-forest/35 text-forest hover:bg-lime/30 press grid h-8 w-8 shrink-0 place-items-center rounded-full border"
            >
              <Plus className="h-4 w-4" />
            </button>
          )
        ))}

      {player.status === "WAITING" && (
        <BlockMenu label={`More for ${player.nickname}`} items={menu} disabled={pending} />
      )}

      {player.status === "EXPECTED" && (
        <Button
          size="sm"
          variant="accent"
          onClick={onCheckIn}
          disabled={pending}
          className="h-8 shrink-0 px-2.5"
        >
          <UserCheck className="h-3.5 w-3.5" /> In
        </Button>
      )}

      {player.status === "DONE" && (
        <Button
          size="sm"
          variant="paper"
          onClick={onRequeue}
          disabled={pending}
          className="h-8 shrink-0 px-2.5"
        >
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
