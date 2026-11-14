"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  ClipboardPaste,
  Crosshair,
  HeartHandshake,
  Link2,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Undo2,
  UserCheck,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addAllActivePlayers,
  addPlayerToGameDay,
  checkInPlayer,
  undoCheckIn,
  createPairingRequest,
  createQuickPlayer,
  deletePairingRequest,
  markPlayerDone,
  removePlayerFromGameDay,
  requeuePlayer,
  setPermanentPartner,
} from "@/lib/actions/gamedays";
import type { BoardPlayer } from "@/lib/board-types";
import { CATEGORY_SHORT } from "@/lib/fees";
import { LEVEL_OPTIONS, type LevelKey } from "@/lib/levels";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Modal } from "@/components/ui/modal";
import { SignupTextPanel } from "@/components/app/signup-text-panel";
import { addPlayersFromText } from "@/lib/actions/signup-text";
import type { SignupCheck } from "@/lib/signup-check";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type DatabasePlayer = {
  id: string;
  nickname: string;
  fullName: string | null;
  level: string;
  levelLabel: string;
  category: "ACTIVE" | "INACTIVE" | "ALUMNI" | "APPLICANT" | "NON_AFFILIATE";
};

type AnyResult = { ok: true; message?: string } | { ok: false; error: string };

export function SignupManager({
  gameDayId,
  gameDayName,
  players,
  database,
}: {
  gameDayId: string;
  gameDayName: string;
  players: BoardPlayer[];
  database: DatabasePlayer[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirmSpec, setConfirmSpec] = React.useState<ConfirmSpec | null>(null);
  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState<"all" | "expected" | "waiting" | "done">("all");
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const [pasteCheck, setPasteCheck] = React.useState<SignupCheck | null>(null);
  const [quick, setQuick] = React.useState({ nickname: "", level: "C", category: "ACTIVE" });
  const [addQuery, setAddQuery] = React.useState("");

  const act = (fn: () => Promise<AnyResult>, onSuccess?: () => void) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        haptic("success");
        toast.success(result.message ?? "Saved.");
        onSuccess?.();
        router.refresh();
      } else {
        haptic("warning");
        toast.error(result.error);
      }
    });
  };

  const sessionIds = new Set(players.map((player) => player.playerId));
  const available = database
    .filter((player) => !sessionIds.has(player.id))
    .filter((player) => {
      const haystack = `${player.nickname} ${player.fullName ?? ""} ${player.levelLabel}`.toLowerCase();
      return haystack.includes(addQuery.toLowerCase());
    })
    .slice(0, 12);

  const filtered = players
    .filter((player) => tab === "all" || player.status === tab.toUpperCase())
    .filter((player) => {
      const haystack = `${player.nickname} ${player.fullName ?? ""} ${player.levelLabel}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });

  const counts = {
    all: players.length,
    expected: players.filter((player) => player.status === "EXPECTED").length,
    waiting: players.filter((player) => player.status === "WAITING").length,
    done: players.filter((player) => player.status === "DONE").length,
  };

  const addNewPlayer = () => {
    if (!quick.nickname.trim()) {
      toast.error("Enter a nickname.");
      return;
    }
    startTransition(async () => {
      const created = await createQuickPlayer({
        nickname: quick.nickname,
        level: quick.level as LevelKey,
        category: quick.category as "ACTIVE",
        fullName: null,
        contact: null,
        notes: null,
      });
      if (!created.ok) {
        haptic("warning");
        toast.error(created.error);
        return;
      }
      const added = await addPlayerToGameDay(gameDayId, created.data!.id, true);
      if (added.ok) {
        haptic("success");
        toast.success(`${quick.nickname} added and checked in.`);
        setQuickOpen(false);
        setQuick({ nickname: "", level: "C", category: "ACTIVE" });
        router.refresh();
      } else {
        toast.error(added.error);
      }
    });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
      <div className="space-y-4">
        <div className="glass border-line bg-paper/85 sticky top-17 z-20 flex flex-wrap items-center gap-2 rounded-2xl border p-2 sm:p-3 lg:top-2">
          <div className="-mx-1 flex w-full [scrollbar-width:none] gap-1 overflow-x-auto px-1 sm:w-auto">
            {(
              [
                ["all", "All", counts.all],
                ["expected", "Expected", counts.expected],
                ["waiting", "In queue", counts.waiting],
                ["done", "Done", counts.done],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "press shrink-0 rounded-full px-3 py-2 text-[11px] font-semibold whitespace-nowrap",
                  tab === value ? "bg-forest text-cream" : "text-muted hover:bg-cream-deep",
                )}
              >
                {label}{" "}
                <span
                  className={cn(
                    "ml-1 font-mono text-[9px]",
                    tab === value ? "text-lime/80" : "text-muted/70",
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="text-muted pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sign-ups…"
              className="h-9 pl-8 text-[12px]"
            />
          </div>
        </div>

        <Card>
          <div className="border-line/80 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h2 className="font-display text-base font-bold">{gameDayName} sign-ups</h2>
              <p className="text-muted text-[11px]">
                Signing up does not queue a player. Check them in when they arrive.
              </p>
            </div>
            <Badge tone="lime">{players.length} on the list</Badge>
          </div>

          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No players in this view"
                description="Add players from the database panel, or create a new player."
                action={
                  <Button size="sm" variant="primary" onClick={() => setQuickOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> New player
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="divide-line/60 divide-y">
              {filtered.map((player) => (
                <PlayerRow
                  key={player.sessionPlayerId}
                  player={player}
                  players={players}
                  gameDayId={gameDayId}
                  pending={pending}
                  act={act}
                  onRemove={() =>
                    setConfirmSpec({
                      title: `Remove ${player.nickname} from this game day?`,
                      description: "They can be added back later with check-in or as a walk-in.",
                      confirmLabel: "Remove player",
                      cancelLabel: "Keep player",
                      tone: "danger",
                      onConfirm: () => act(() => removePlayerFromGameDay(player.sessionPlayerId)),
                    })
                  }
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-3 xl:sticky xl:top-6 xl:h-fit">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Add from database</h2>
            <span className="text-muted font-mono text-[10px]">{database.length} players</span>
          </div>
          <div className="relative mt-3">
            <Search className="text-muted pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={addQuery}
              onChange={(event) => setAddQuery(event.target.value)}
              placeholder="Search nickname or level…"
              className="h-9 pl-8 text-[12px]"
            />
          </div>

          <div className="mt-3 max-h-[360px] space-y-1 overflow-y-auto">
            {available.length === 0 ? (
              <p className="text-muted px-2 py-6 text-center text-[11px]">
                {addQuery
                  ? "No matching player left to add."
                  : "Everyone in the database is already on this game day."}
              </p>
            ) : (
              available.map((player) => (
                <div
                  key={player.id}
                  className="hover:bg-cream/60 flex items-center gap-2 rounded-lg px-2 py-1"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">{player.nickname}</p>
                    <p className="text-muted text-[9px]">
                      {CATEGORY_SHORT[player.category]} · {player.levelLabel}
                    </p>
                  </div>
                  <LevelBadge level={player.level} />
                  <button
                    type="button"
                    onClick={() =>
                      act(
                        () => addPlayerToGameDay(gameDayId, player.id, false),
                        () => setAddQuery(""),
                      )
                    }
                    disabled={pending}
                    className="press bg-cream-deep text-forest hover:bg-lime grid h-9 w-9 place-items-center rounded-full"
                    title="Add to sign-ups"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      act(
                        () => addPlayerToGameDay(gameDayId, player.id, true),
                        () => setAddQuery(""),
                      )
                    }
                    disabled={pending}
                    className="press bg-forest text-lime hover:bg-forest-deep grid h-9 w-9 place-items-center rounded-full"
                    title="Add and check in"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-line/70 mt-3 grid grid-cols-2 gap-2 border-t pt-3">
            <Button size="sm" variant="accent" className="col-span-2" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste Messenger list
            </Button>
            <Button
              size="sm"
              variant="paper"
              onClick={() => act(() => addAllActivePlayers(gameDayId))}
              disabled={pending}
            >
              <Users className="h-3.5 w-3.5" /> Add all active
            </Button>
            <Button size="sm" variant="primary" onClick={() => setQuickOpen(true)}>
              <UserRoundPlus className="h-3.5 w-3.5" /> New player
            </Button>
          </div>
        </Card>

        <div
          data-trim-id="signups.tip"
          className="border-line bg-cream-deep/50 text-muted rounded-2xl border p-4 text-[11px] leading-relaxed"
        >
          <p className="text-ink mb-1 font-semibold">Queue-master tip</p>
          Use <span className="font-semibold">Check in</span> only when the player is physically at the court.
          The wait timer starts at that moment, and only checked-in players are paired.
        </div>
      </div>

      {/* Quick create player */}
      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Paste the Messenger list"
        description="Adds everyone on the list who is not signed up yet. Nobody is removed. Re-paste it whenever players update the chat."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPasteOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() =>
                act(
                  () => addPlayersFromText(gameDayId, pasteText),
                  () => {
                    setPasteOpen(false);
                    setPasteText("");
                  },
                )
              }
              loading={pending}
              disabled={!pasteCheck?.ready}
            >
              <ClipboardPaste className="h-4 w-4" /> Add to sign-ups
            </Button>
          </>
        }
      >
        <SignupTextPanel
          text={pasteText}
          onTextChange={setPasteText}
          gameDayId={gameDayId}
          onChecked={setPasteCheck}
        />
      </Modal>

      <Modal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        title="New player"
        description="Adds them to the player database and checks them into this game day."
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuickOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addNewPlayer} loading={pending}>
              <UserRoundPlus className="h-4 w-4" /> Add & check in
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nickname">
            <Input
              value={quick.nickname}
              onChange={(event) => setQuick({ ...quick, nickname: event.target.value })}
              placeholder="e.g. Lia"
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Level">
              <Select
                value={quick.level}
                onChange={(event) => setQuick({ ...quick, level: event.target.value })}
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
                value={quick.category}
                onChange={(event) => setQuick({ ...quick, category: event.target.value })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ALUMNI">Alumni</option>
                <option value="APPLICANT">Applicant</option>
                <option value="NON_AFFILIATE">Non-affiliate</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "EXPECTED") return "Expected";
  if (status === "WAITING") return "In queue";
  if (status === "PLAYING") return "On court";
  return "Done";
}

/**
 * One sign-up, with everything the queue master sets for a player right on the row:
 * check in / undo / done, a permanent partner (saves as soon as it is picked), and
 * pairing requests. No dialog to open first.
 */
function PlayerRow({
  player,
  players,
  gameDayId,
  pending,
  act,
  onRemove,
}: {
  player: BoardPlayer;
  players: BoardPlayer[];
  gameDayId: string;
  pending: boolean;
  act: (fn: () => Promise<AnyResult>, onSuccess?: () => void) => void;
  onRemove: () => void;
}) {
  const [requestType, setRequestType] = React.useState<"PAIR_WITH" | "PLAY_AGAINST">("PAIR_WITH");
  const [requestTarget, setRequestTarget] = React.useState("");
  // Shows the partner just picked until the saved value comes back.
  const [partnerChoice, setPartnerChoice] = React.useState<string | null>(null);
  const partner = partnerChoice ?? player.permanentPartnerId ?? "";
  const others = players.filter((row) => row.sessionPlayerId !== player.sessionPlayerId);
  const settable = player.status !== "DONE";
  const [open, setOpen] = React.useState(false);
  const hasSettings = Boolean(player.permanentPartnerNickname) || player.requests.length > 0;

  const statusDot = {
    EXPECTED: "bg-gold",
    WAITING: "bg-forest",
    PLAYING: "bg-sky-500",
    DONE: "bg-muted/50",
  }[player.status as "EXPECTED" | "WAITING" | "PLAYING" | "DONE"];

  return (
    <div className="hover:bg-cream/30 animate-pop-in px-3 py-2.5 transition-colors sm:px-4 sm:py-3">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Avatar name={player.nickname} level={player.levelLabel} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[14px] leading-tight font-semibold">{player.nickname}</p>
            {player.priority && <Badge tone="lime">Priority</Badge>}
          </div>
          <div className="text-muted mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-tight">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot)} aria-hidden="true" />
            <span className="truncate">
              {statusLabel(player.status)} · {CATEGORY_SHORT[player.category]}
              {player.gamesPlayed > 0 &&
                ` · ${player.gamesPlayed} ${player.gamesPlayed === 1 ? "game" : "games"}`}
              {player.joinedAt &&
                ` · ${new Date(player.joinedAt).toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Asia/Manila",
                })}`}
            </span>
          </div>
          {(player.permanentPartnerNickname || player.requests.length > 0) && (
            <div className="text-muted mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[10px]">
              {player.permanentPartnerNickname && (
                <span className="text-forest inline-flex items-center gap-0.5">
                  <Link2 className="h-2.5 w-2.5" /> {player.permanentPartnerNickname}
                </span>
              )}
              {player.requests.map((request) => (
                <span
                  key={request.id}
                  className={cn(
                    "inline-flex items-center gap-0.5",
                    request.type === "PAIR_WITH" ? "text-forest" : "text-coral",
                  )}
                >
                  {request.type === "PAIR_WITH" ? (
                    <HeartHandshake className="h-2.5 w-2.5" />
                  ) : (
                    <Crosshair className="h-2.5 w-2.5" />
                  )}
                  {request.targetNickname}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {player.status === "EXPECTED" && (
            <Button
              size="sm"
              variant="accent"
              onClick={() => act(() => checkInPlayer(player.sessionPlayerId))}
              disabled={pending}
              className="px-3"
            >
              <UserCheck className="h-3.5 w-3.5" /> Check in
            </Button>
          )}
          {player.status === "WAITING" && (
            <Button
              size="sm"
              variant="paper"
              onClick={() => act(() => markPlayerDone(player.sessionPlayerId))}
              disabled={pending}
              className="px-3"
            >
              <Check className="h-3.5 w-3.5" /> Done
            </Button>
          )}
          {player.status === "DONE" && (
            <Button
              size="sm"
              variant="paper"
              onClick={() => act(() => requeuePlayer(player.sessionPlayerId))}
              disabled={pending}
              className="px-3"
            >
              <ChevronRight className="h-3.5 w-3.5" /> Requeue
            </Button>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={`More for ${player.nickname}`}
            title="Partner, requests and more"
            className={cn(
              "press relative grid h-9 w-9 place-items-center rounded-full border",
              open
                ? "border-ink bg-ink text-cream"
                : "border-line text-muted hover:bg-cream-deep hover:text-ink bg-white",
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
            {hasSettings && !open && (
              <span className="bg-gold absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-pop-in mt-2 flex flex-wrap items-center justify-end gap-1.5 sm:ml-12">
          {player.status === "WAITING" && player.gamesPlayed === 0 && (
            <Button
              size="sm"
              variant="paper"
              onClick={() => act(() => undoCheckIn(player.sessionPlayerId))}
              disabled={pending}
            >
              <Undo2 className="h-3.5 w-3.5" /> Undo check-in
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemove}
            disabled={pending}
            className="text-coral hover:bg-coral-soft hover:text-coral"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove from game day
          </Button>
        </div>
      )}

      {settable && open && (
        <div className="border-line bg-cream/40 animate-pop-in mt-2.5 grid gap-2 rounded-2xl border p-3 sm:ml-12 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <label className="flex min-w-0 items-center gap-2">
            <span className="text-muted inline-flex shrink-0 items-center gap-1 text-[10px] font-bold tracking-[0.12em] uppercase">
              <Link2 className="h-3 w-3" /> Partner
            </span>
            <Select
              value={partner}
              disabled={pending}
              aria-label={`Permanent partner for ${player.nickname}`}
              onChange={(event) => {
                const value = event.target.value;
                setPartnerChoice(value);
                act(
                  () => setPermanentPartner(gameDayId, player.playerId, value || null),
                  () => setPartnerChoice(null),
                );
              }}
              className="h-8 min-w-0 text-[12px]"
            >
              <option value="">None</option>
              {others.map((row) => (
                <option key={row.sessionPlayerId} value={row.playerId}>
                  {row.nickname} · {row.levelLabel}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-muted inline-flex shrink-0 items-center gap-1 text-[10px] font-bold tracking-[0.12em] uppercase">
              <HeartHandshake className="h-3 w-3" /> Requests
            </span>
            {player.requests.map((request) => (
              <span
                key={request.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2 text-[11px]",
                  request.type === "PAIR_WITH"
                    ? "border-forest/30 text-forest"
                    : "border-coral/40 text-coral",
                )}
              >
                {request.type === "PAIR_WITH" ? "with" : "vs"}{" "}
                <span className="font-semibold">{request.targetNickname}</span>
                <button
                  type="button"
                  onClick={() => act(() => deletePairingRequest(request.id))}
                  disabled={pending}
                  className="hover:bg-coral-soft grid h-4 w-4 place-items-center rounded-full"
                  aria-label={`Remove request ${request.targetNickname}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <Select
              value={requestType}
              onChange={(event) => setRequestType(event.target.value as "PAIR_WITH" | "PLAY_AGAINST")}
              aria-label={`Request type for ${player.nickname}`}
              className="h-8 w-auto text-[12px]"
            >
              <option value="PAIR_WITH">Partner with</option>
              <option value="PLAY_AGAINST">Play against</option>
            </Select>
            <Select
              value={requestTarget}
              onChange={(event) => setRequestTarget(event.target.value)}
              aria-label={`Request player for ${player.nickname}`}
              className="h-8 w-auto min-w-0 text-[12px]"
            >
              <option value="">Pick a player…</option>
              {others.map((row) => (
                <option key={row.sessionPlayerId} value={row.playerId}>
                  {row.nickname} · {row.levelLabel}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="accent"
              disabled={!requestTarget || pending}
              onClick={() =>
                act(
                  () => createPairingRequest(gameDayId, player.playerId, requestType, requestTarget),
                  () => setRequestTarget(""),
                )
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
