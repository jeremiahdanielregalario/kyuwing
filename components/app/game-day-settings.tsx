"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  CircleCheck,
  Clock3,
  LayoutGrid,
  Play,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { deleteGameDay, setGameDayStatus, startGameDay, updateGameDay } from "@/lib/actions/gamedays";
import { applyCourtSetup } from "@/lib/court-setup";
import { StartGameDayDialog } from "@/components/app/start-game-day-dialog";
import type { BoardGameDay } from "@/lib/board-types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourtRateField } from "@/components/app/court-rate-field";
import { CourtPlanEditor } from "@/components/app/court-plan-editor";
import { fitPlan, gameTime, planProblem, planWindow } from "@/lib/court-plan";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type VenueOption = { id: string; name: string; shortName: string };
type Slot = { id: string; label: string; start: string; end: string; courts: number; courtLabels?: string[] };
type AnyResult = { ok: true; message?: string } | { ok: false; error: string };

function dateValue(iso: string) {
  return iso.slice(0, 10);
}

export function GameDaySettings({
  gameDay,
  venues,
  stats,
}: {
  gameDay: BoardGameDay;
  venues: VenueOption[];
  stats: { players: number; matches: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState(gameDay.name);
  const [venueId, setVenueId] = React.useState(gameDay.venue.id);
  const [date, setDate] = React.useState(dateValue(gameDay.date));
  const [type, setType] = React.useState(gameDay.type);
  const [notes, setNotes] = React.useState(gameDay.notes ?? "");
  const [queueMasterName, setQueueMasterName] = React.useState(gameDay.queueMasterName ?? "");
  const [financeMemberName, setFinanceMemberName] = React.useState(gameDay.financeMemberName ?? "");
  const [courtRate, setCourtRate] = React.useState(
    gameDay.courtRatePerHour ? String(gameDay.courtRatePerHour) : "",
  );
  // Blocks always run back to back across the game time (see lib/court-plan.ts).
  const [slots, setSlots] = React.useState<Slot[]>(() => {
    const game = planWindow(gameDay.courtPlan);
    if (!game) return gameDay.courtPlan;
    const fixed = gameTime(game.start, game.end);
    return fitPlan(gameDay.courtPlan, fixed.start, fixed.end);
  });
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [startOpen, setStartOpen] = React.useState(false);
  const [confirmSpec, setConfirmSpec] = React.useState<ConfirmSpec | null>(null);
  const [confirmText, setConfirmText] = React.useState("");

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

  const save = () => {
    const problem = planProblem(slots);
    if (problem) {
      toast.error(problem);
      return;
    }
    act(() =>
      updateGameDay({
        id: gameDay.id,
        name,
        venueId,
        date,
        type,
        notes: notes || null,
        queueMasterName: queueMasterName || null,
        financeMemberName: financeMemberName || null,
        courtRatePerHour: courtRate ? Number(courtRate) : null,
        courtPlan: slots,
      }),
    );
  };

  const totalCourtHours = slots.reduce((sum, slot) => {
    const [startH, startM] = slot.start.split(":").map(Number);
    const [endH, endM] = slot.end.split(":").map(Number);
    return sum + Math.max(0, endH * 60 + endM - (startH * 60 + startM)) * slot.courts;
  }, 0);

  return (
    <div className="space-y-5">
      {/* Status */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                gameDay.status === "LIVE" && "bg-forest text-lime",
                gameDay.status === "DRAFT" && "bg-amber-100 text-amber-800",
                gameDay.status === "COMPLETED" && "bg-cream-deep text-muted",
              )}
            >
              {gameDay.status === "LIVE" ? (
                <Play className="h-4 w-4" />
              ) : gameDay.status === "DRAFT" ? (
                <Clock3 className="h-4 w-4" />
              ) : (
                <CircleCheck className="h-4 w-4" />
              )}
            </span>
            <div>
              <p className="text-muted text-[10px] font-bold tracking-[0.14em] uppercase">Session status</p>
              <p className="font-display text-lg leading-tight font-bold">{gameDay.status}</p>
              <p data-trim-id="settings.status-sub" className="text-muted text-[11px]">
                {stats.players} sign-ups · {stats.matches} matches logged
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {gameDay.status !== "LIVE" && (
              <Button
                size="sm"
                variant="accent"
                onClick={() =>
                  gameDay.status === "DRAFT" && gameDay.courtPlan.length
                    ? setStartOpen(true)
                    : act(() => setGameDayStatus(gameDay.id, "LIVE"))
                }
                loading={pending}
              >
                <Play className="h-3.5 w-3.5" />{" "}
                {gameDay.status === "COMPLETED" ? "Reopen as live" : "Start game day"}
              </Button>
            )}
            {gameDay.status === "LIVE" && (
              <Button
                size="sm"
                variant="paper"
                onClick={() =>
                  setConfirmSpec({
                    title: "Close this game day?",
                    description:
                      "Live and suggested matches are cancelled and remaining players are marked done. Fees stay editable.",
                    confirmLabel: "Close game day",
                    cancelLabel: "Keep running",
                    tone: "danger",
                    onConfirm: () =>
                      act(
                        () => setGameDayStatus(gameDay.id, "COMPLETED"),
                        () => router.push(`/app/gamedays/${gameDay.id}/reports`),
                      ),
                  })
                }
                loading={pending}
              >
                <CircleCheck className="h-3.5 w-3.5" /> Complete day
              </Button>
            )}
            {gameDay.status === "COMPLETED" && (
              <Button
                size="sm"
                variant="paper"
                onClick={() => act(() => setGameDayStatus(gameDay.id, "DRAFT"))}
                loading={pending}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Back to draft
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Details */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Game-day details</h2>
              <p data-trim-id="settings.details-note" className="text-muted text-[11px]">
                These are safe to change before or during play.
              </p>
            </div>
            <span className="bg-cream-deep text-forest grid h-9 w-9 place-items-center rounded-xl">
              <Settings2 className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <Field label="Name">
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Venue">
                <Select value={venueId} onChange={(event) => setVenueId(event.target.value)}>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.shortName} · {venue.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date">
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Game-day type">
                <Select
                  value={type}
                  onChange={(event) => setType(event.target.value as BoardGameDay["type"])}
                >
                  <option value="REGULAR">Regular</option>
                  <option value="TIPID">Tipid (court fee only)</option>
                  <option value="MEGA">MEGA</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Queue master" hint="Shown on the session report.">
                <Input
                  value={queueMasterName}
                  onChange={(event) => setQueueMasterName(event.target.value)}
                  placeholder="Full name"
                  maxLength={60}
                />
              </Field>
              <Field label="Finance member" hint="Shown on the session report.">
                <Input
                  value={financeMemberName}
                  onChange={(event) => setFinanceMemberName(event.target.value)}
                  placeholder="Full name"
                  maxLength={60}
                />
              </Field>
            </div>

            <CourtRateField
              value={courtRate}
              onChange={setCourtRate}
              plan={slots}
              venueShortName={
                venues.find((venue) => venue.id === venueId)?.shortName ?? gameDay.venue.shortName
              }
            />

            <Field
              label="Notes"
              hint="Court assignments, fee reminders, anything the next queue master should know."
            >
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={500}
              />
            </Field>
          </div>
        </Card>

        {/* Court plan */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Court blocks</h2>
              <p data-trim-id="settings.courts-note" className="text-muted text-[11px]">
                The game time, and how many courts are open in each block of it.
              </p>
            </div>
            <span className="bg-cream-deep text-forest grid h-9 w-9 place-items-center rounded-xl">
              <LayoutGrid className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-4">
            <CourtPlanEditor
              blocks={slots}
              onChange={setSlots}
              makeBlock={(from, index) => ({
                ...from,
                id: `slot-${Date.now()}-${index}`,
              })}
              renderExtra={(slot, _index, update) => (
                <div className="mt-2">
                  <span
                    data-trim-id="settings.court-names-note"
                    className="text-muted mb-1 block text-[10px] font-bold tracking-[0.12em] uppercase"
                  >
                    Court names (optional)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {Array.from({ length: slot.courts }, (_, courtIndex) => (
                      <Input
                        key={courtIndex}
                        value={slot.courtLabels?.[courtIndex] ?? ""}
                        placeholder={`Court ${courtIndex + 1}`}
                        maxLength={24}
                        className="h-9 text-[12px]"
                        aria-label={`Court ${courtIndex + 1} name`}
                        onChange={(event) => {
                          const value = event.target.value;
                          update({
                            courtLabels: Array.from({ length: slot.courts }, (_, position) =>
                              position === courtIndex ? value : (slot.courtLabels?.[position] ?? ""),
                            ),
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            />
          </div>

          <div className="bg-cream-deep/60 mt-4 flex items-center justify-between rounded-xl px-3 py-2 text-[11px]">
            <span className="text-muted inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> {slots.length} blocks
            </span>
            <span className="text-forest font-mono font-bold">
              {Math.round(totalCourtHours / 60)} court-hours
            </span>
          </div>

          <Button onClick={save} loading={pending} className="mt-4 w-full">
            <Save className="h-4 w-4" /> Save changes
          </Button>
        </Card>
      </div>

      {/* Danger zone */}
      <Card className="border-coral/30 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="bg-coral-soft grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#a8331a]">
              <TriangleAlert className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold">Delete this game day</h2>
              <p
                data-trim-id="settings.danger-note"
                className="text-muted max-w-lg text-[11px] leading-relaxed"
              >
                This removes the session, every sign-up, match, and payment record. Export the Excel or PDF
                report first if you need a copy.
              </p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmText("");
        }}
        title="Delete game day"
        description="This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirmText.trim().toUpperCase() !== "DELETE" || pending}
              onClick={() =>
                act(
                  () => deleteGameDay(gameDay.id),
                  () => router.push("/app/gamedays"),
                )
              }
            >
              <Trash2 className="h-4 w-4" /> Delete permanently
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="border-coral/30 bg-coral-soft rounded-xl border px-3.5 py-3 text-[12px] text-[#a8331a]">
            <p className="font-semibold">{gameDay.name}</p>
            <p className="mt-0.5 text-[11px]">
              {stats.players} sign-ups · {stats.matches} matches will also be deleted.
            </p>
          </div>
          <Field label="Type DELETE to confirm">
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="DELETE"
              autoFocus
            />
          </Field>
          <p className="text-muted inline-flex items-center gap-1.5 text-[11px]">
            <Check className="h-3.5 w-3.5" /> Tip: download the report from the Reports tab first.
          </p>
        </div>
      </Modal>

      {startOpen && (
        <StartGameDayDialog
          plan={gameDay.courtPlan}
          venue={gameDay.venue.shortName || gameDay.venue.name}
          pending={pending}
          onClose={() => setStartOpen(false)}
          onStart={(setup) =>
            act(
              () => startGameDay(gameDay.id, setup),
              () => {
                setStartOpen(false);
                // Keep the plan editor in step, so saving settings later keeps the confirmed courts.
                setSlots((current) => {
                  const result = applyCourtSetup(current, setup);
                  return "plan" in result ? result.plan : current;
                });
              },
            )
          }
        />
      )}

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </div>
  );
}
