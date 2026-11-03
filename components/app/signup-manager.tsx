"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  Crosshair,
  HeartHandshake,
  Link2,
  Plus,
  Search,
  Trash2,
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
import { LEVELS } from "@/lib/levels";
import { formatDuration } from "@/lib/datetime";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type DatabasePlayer = {
  id: string;
  nickname: string;
  fullName: string | null;
  level: string;
  levelLabel: string;
  category: "ACTIVE" | "INACTIVE" | "ALUMNI" | "APPLICANT";
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
  const [manageId, setManageId] = React.useState<string | null>(null);
  const [manageOpenedAt, setManageOpenedAt] = React.useState(0);
  const [partnerId, setPartnerId] = React.useState("");
  const [requestType, setRequestType] = React.useState<"PAIR_WITH" | "PLAY_AGAINST">("PAIR_WITH");
  const [requestTarget, setRequestTarget] = React.useState("");
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [quick, setQuick] = React.useState({ nickname: "", level: "C", category: "ACTIVE" });
  const [addQuery, setAddQuery] = React.useState("");

  const act = (fn: () => Promise<AnyResult>, onSuccess?: () => void) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        onSuccess?.();
        router.refresh();
      } else {
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

  const managed = players.find((player) => player.sessionPlayerId === manageId) ?? null;

  const openManage = (player: BoardPlayer) => {
    setManageId(player.sessionPlayerId);
    setManageOpenedAt(Date.now());
    setPartnerId(player.permanentPartnerId ?? "");
    setRequestType("PAIR_WITH");
    setRequestTarget("");
  };

  const addNewPlayer = () => {
    if (!quick.nickname.trim()) {
      toast.error("Enter a nickname.");
      return;
    }
    startTransition(async () => {
      const created = await createQuickPlayer({
        nickname: quick.nickname,
        level: quick.level as (typeof LEVELS)[number]["key"],
        category: quick.category as "ACTIVE",
        fullName: null,
        contact: null,
        notes: null,
      });
      if (!created.ok) {
        toast.error(created.error);
        return;
      }
      const added = await addPlayerToGameDay(gameDayId, created.data!.id, true);
      if (added.ok) {
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
        <div className="border-line bg-paper flex flex-wrap items-center gap-2 rounded-2xl border p-3">
          <div className="flex flex-wrap gap-1">
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
                  "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
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
                <div
                  key={player.sessionPlayerId}
                  className="hover:bg-cream/30 flex flex-wrap items-center gap-3 px-4 py-3 transition"
                >
                  <Avatar name={player.nickname} level={player.levelLabel} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold">{player.nickname}</p>
                      <Badge tone={statusTone(player.status)}>{statusLabel(player.status)}</Badge>
                      {player.priority && <Badge tone="lime">Priority</Badge>}
                    </div>
                    <div className="text-muted mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                      <span>{CATEGORY_SHORT[player.category]}</span>
                      <span>· {player.gamesPlayed} games</span>
                      {player.joinedAt && (
                        <span>
                          · arrived{" "}
                          {new Date(player.joinedAt).toLocaleTimeString("en-PH", {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: "Asia/Manila",
                          })}
                        </span>
                      )}
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
                  </div>
                  <LevelBadge level={player.level} />

                  <div className="flex items-center gap-1">
                    {player.status === "EXPECTED" && (
                      <Button
                        size="sm"
                        variant="accent"
                        onClick={() => act(() => checkInPlayer(player.sessionPlayerId))}
                        disabled={pending}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Check in
                      </Button>
                    )}
                    {player.status === "WAITING" && (
                      <Button size="sm" variant="paper" onClick={() => openManage(player)} disabled={pending}>
                        <Link2 className="h-3.5 w-3.5" /> Pair
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openManage(player)} disabled={pending}>
                      Details
                    </Button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmSpec({
                          title: `Remove ${player.nickname} from this game day?`,
                          description: "They can be added back later with check-in or as a walk-in.",
                          confirmLabel: "Remove player",
                          cancelLabel: "Keep player",
                          tone: "danger",
                          onConfirm: () => act(() => removePlayerFromGameDay(player.sessionPlayerId)),
                        })
                      }
                      disabled={pending}
                      className="text-muted hover:bg-coral-soft hover:text-coral grid h-8 w-8 place-items-center rounded-full transition"
                      aria-label={`Remove ${player.nickname}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
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
                  className="hover:bg-cream/60 flex items-center gap-2 rounded-lg px-2 py-1.5"
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
                    className="bg-cream-deep text-forest hover:bg-lime grid h-7 w-7 place-items-center rounded-full transition"
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
                    className="bg-forest text-lime hover:bg-forest-deep grid h-7 w-7 place-items-center rounded-full transition"
                    title="Add and check in"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-line/70 mt-3 grid grid-cols-2 gap-2 border-t pt-3">
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

      {/* Manage player modal */}
      <Modal
        open={Boolean(managed)}
        onClose={() => setManageId(null)}
        title={managed ? `${managed.nickname} · ${managed.levelLabel}` : "Player"}
        description="Set a permanent partner or log a pairing request."
        size="md"
      >
        {managed && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(managed.status)}>{statusLabel(managed.status)}</Badge>
              <Badge tone="outline">{CATEGORY_SHORT[managed.category]}</Badge>
              <Badge tone="outline">{managed.gamesPlayed} games today</Badge>
              {managed.status === "WAITING" && managed.queuedAt && (
                <Badge tone="neutral">
                  Waiting {formatDuration(Math.max(0, manageOpenedAt - Date.parse(managed.queuedAt)) / 1000)}
                </Badge>
              )}
            </div>

            <div className="border-line bg-cream/30 rounded-2xl border p-3.5">
              <p className="text-muted text-[10px] font-bold tracking-[0.14em] uppercase">
                Permanent partner
              </p>
              <p className="text-muted mt-1 text-[11px]">
                They will be kept on the same team every time both are available.
              </p>
              <div className="mt-2 flex gap-2">
                <Select
                  value={partnerId}
                  onChange={(event) => setPartnerId(event.target.value)}
                  className="h-9 text-[12px]"
                >
                  <option value="">No permanent partner</option>
                  {players
                    .filter((player) => player.sessionPlayerId !== managed.sessionPlayerId)
                    .map((player) => (
                      <option key={player.sessionPlayerId} value={player.playerId}>
                        {player.nickname} · {player.levelLabel}
                      </option>
                    ))}
                </Select>
                <Button
                  size="sm"
                  onClick={() =>
                    act(() => setPermanentPartner(gameDayId, managed.playerId, partnerId || null))
                  }
                  disabled={pending}
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="border-line bg-cream/30 rounded-2xl border p-3.5">
              <p className="text-muted text-[10px] font-bold tracking-[0.14em] uppercase">Pairing requests</p>
              {managed.requests.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {managed.requests.map((request) => (
                    <div
                      key={request.id}
                      className="border-line/70 bg-paper flex items-center gap-2 rounded-lg border px-2.5 py-2"
                    >
                      {request.type === "PAIR_WITH" ? (
                        <HeartHandshake className="text-forest h-3.5 w-3.5" />
                      ) : (
                        <Crosshair className="text-coral h-3.5 w-3.5" />
                      )}
                      <span className="flex-1 text-[11px]">
                        {request.type === "PAIR_WITH" ? "Partner with" : "Play against"}{" "}
                        <span className="font-semibold">{request.targetNickname}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => act(() => deletePairingRequest(request.id))}
                        disabled={pending}
                        className="text-muted hover:bg-coral-soft hover:text-coral grid h-6 w-6 place-items-center rounded-full"
                        aria-label="Remove request"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted mt-1 text-[11px]">
                  No special requests. The engine will pair them normally.
                </p>
              )}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Select
                  value={requestType}
                  onChange={(event) => setRequestType(event.target.value as "PAIR_WITH" | "PLAY_AGAINST")}
                  className="h-9 text-[12px]"
                >
                  <option value="PAIR_WITH">Partner with</option>
                  <option value="PLAY_AGAINST">Play against</option>
                </Select>
                <Select
                  value={requestTarget}
                  onChange={(event) => setRequestTarget(event.target.value)}
                  className="h-9 text-[12px]"
                >
                  <option value="">Pick a player…</option>
                  {players
                    .filter((player) => player.sessionPlayerId !== managed.sessionPlayerId)
                    .map((player) => (
                      <option key={player.sessionPlayerId} value={player.playerId}>
                        {player.nickname} · {player.levelLabel}
                      </option>
                    ))}
                </Select>
                <Button
                  size="sm"
                  variant="accent"
                  disabled={!requestTarget || pending}
                  onClick={() =>
                    act(
                      () => createPairingRequest(gameDayId, managed.playerId, requestType, requestTarget),
                      () => setRequestTarget(""),
                    )
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>

            <div className="border-line/70 flex flex-wrap gap-2 border-t pt-4">
              {managed.status === "EXPECTED" && (
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() => act(() => checkInPlayer(managed.sessionPlayerId))}
                  disabled={pending}
                >
                  <UserCheck className="h-3.5 w-3.5" /> Check in
                </Button>
              )}
              {managed.status === "WAITING" && (
                <Button
                  size="sm"
                  variant="paper"
                  onClick={() =>
                    act(
                      () => markPlayerDone(managed.sessionPlayerId),
                      () => setManageId(null),
                    )
                  }
                  disabled={pending}
                >
                  <Check className="h-3.5 w-3.5" /> Done for the day
                </Button>
              )}
              {managed.status === "DONE" && (
                <Button
                  size="sm"
                  variant="paper"
                  onClick={() => act(() => requeuePlayer(managed.sessionPlayerId))}
                  disabled={pending}
                >
                  <ChevronRight className="h-3.5 w-3.5" /> Requeue
                </Button>
              )}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setManageId(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quick create player */}
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
                {LEVELS.map((level) => (
                  <option key={level.key} value={level.key}>
                    {level.label} · {level.bracket}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Player type">
              <Select
                value={quick.category}
                onChange={(event) => setQuick({ ...quick, category: event.target.value })}
              >
                <option value="ACTIVE">Active member</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ALUMNI">Alumni</option>
                <option value="APPLICANT">Applicant</option>
                <option value="APPLICANT">Applicant</option>
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

function statusTone(status: string): "green" | "amber" | "neutral" | "lime" | "sky" {
  if (status === "WAITING") return "green";
  if (status === "EXPECTED") return "amber";
  if (status === "PLAYING") return "sky";
  return "neutral";
}
