"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ClipboardPaste,
  Flame,
  History,
  Snowflake,
  Trash2,
  TrendingDown,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { deleteAttendanceEvent, logAttendanceEvent } from "@/lib/actions/attendance";
import type { AttendanceEventDto } from "@/lib/queries";
import type { RecencySnapshot } from "@/lib/recency";
import { formatGameDate } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

/** Logged lists shown before "Show all". */
const RECENT_LISTS = 3;

const BAND_STYLES: Record<
  RecencySnapshot["band"],
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  hot: { label: "Playing often", icon: Flame, className: "bg-lime/25 text-forest-deep border-lime/50" },
  warm: { label: "Playing", icon: Activity, className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  cooling: {
    label: "Cooling off",
    icon: TrendingDown,
    className: "bg-amber-50 text-amber-900 border-amber-200",
  },
  dormant: { label: "Dormant", icon: Snowflake, className: "bg-sky-50 text-sky-900 border-sky-200" },
  new: { label: "No history", icon: History, className: "bg-cream-deep text-muted border-line" },
};

/** "played 3d ago", "waitlisted today", or null when there is no history. */
export function recencyCaption(snapshot: RecencySnapshot | undefined): string | null {
  if (!snapshot) return null;
  const ago = (days: number) => (days === 0 ? "today" : `${days}d ago`);
  if (snapshot.daysSincePlayed !== null) return `played ${ago(snapshot.daysSincePlayed)}`;
  if (snapshot.daysSinceActive !== null) return `waitlisted ${ago(snapshot.daysSinceActive)}`;
  return null;
}

export function RecencyBadge({ snapshot }: { snapshot: RecencySnapshot | undefined }) {
  const band = snapshot?.band ?? "new";
  const style = BAND_STYLES[band];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        style.className,
      )}
      title={
        snapshot
          ? `${snapshot.bandLabel} · score ${snapshot.score}/100${
              snapshot.daysSincePlayed !== null ? ` · last played ${snapshot.daysSincePlayed}d ago` : ""
            }`
          : "No imported attendance yet"
      }
    >
      <Icon className="h-3 w-3" />
      {style.label}
    </span>
  );
}

export function RecencyPanel({
  events,
  snapshots,
  playerCount,
  today,
}: {
  events: AttendanceEventDto[];
  snapshots: Record<string, RecencySnapshot>;
  playerCount: number;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [showAllLists, setShowAllLists] = React.useState(false);
  const [confirmSpec, setConfirmSpec] = React.useState<ConfirmSpec | null>(null);

  const [date, setDate] = React.useState(today);
  const [kind, setKind] = React.useState<"GAMEDAY" | "TOURNAMENT">("GAMEDAY");
  const [label, setLabel] = React.useState("");
  const [playedText, setPlayedText] = React.useState("");
  const [waitlistText, setWaitlistText] = React.useState("");

  const counts = React.useMemo(() => {
    const tally = { hot: 0, warm: 0, cooling: 0, dormant: 0, new: 0 };
    for (const snapshot of Object.values(snapshots)) tally[snapshot.band] += 1;
    tally.new += Math.max(0, playerCount - Object.keys(snapshots).length);
    return tally;
  }, [snapshots, playerCount]);

  const openDialog = () => {
    setDate(today);
    setKind("GAMEDAY");
    setLabel("");
    setPlayedText("");
    setWaitlistText("");
    setOpen(true);
  };

  const submit = () => {
    startTransition(async () => {
      const result = await logAttendanceEvent({ date, kind, label, playedText, waitlistText });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const summary = result.data;
      toast.success(result.message ?? "Attendance logged.");
      if (summary && summary.unmatched.length > 0) {
        const names = summary.unmatched;
        toast.warning(`${names.length} nickname${names.length === 1 ? "" : "s"} not in the database`, {
          description: `${names.slice(0, 8).join(", ")}${names.length > 8 ? "…" : ""} — add them to the roster, then log the list again.`,
          duration: 12000,
        });
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold">Playing recency</h2>
          <p className="text-muted max-w-xl text-[11px]">
            Scored from the game-day and tournament lists you log below. Recent games count most, waitlisting
            counts less than playing, and a list fades over time — so people who stopped showing up sink.
          </p>
        </div>
        <Button size="sm" onClick={openDialog}>
          <ClipboardPaste className="h-3.5 w-3.5" /> Log attendance
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <BandCount icon={Flame} label="Playing often" value={counts.hot} tone="hot" />
        <BandCount icon={Activity} label="Playing" value={counts.warm} tone="warm" />
        <BandCount icon={TrendingDown} label="Cooling off" value={counts.cooling} tone="cooling" />
        <BandCount icon={Snowflake} label="Dormant" value={counts.dormant} tone="dormant" />
        <BandCount icon={History} label="No history" value={counts.new} tone="new" />
      </div>

      <div className="border-line mt-4 border-t pt-3">
        <div className="flex items-center justify-between">
          <p className="text-muted text-[9px] font-bold tracking-[0.14em] uppercase">Logged lists</p>
          <p className="text-muted font-mono text-[10px]">{events.length} total</p>
        </div>
        {events.length === 0 ? (
          <p className="text-muted mt-2 text-[11px]">
            No attendance logged yet. Paste your latest game-day or tournament list to start scoring.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {(showAllLists ? events : events.slice(0, RECENT_LISTS)).map((event) => (
              <li
                key={event.id}
                className="border-line/70 bg-cream/40 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2"
              >
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                  {event.kind === "TOURNAMENT" ? (
                    <Trophy className="h-3.5 w-3.5 text-amber-600" />
                  ) : (
                    <CalendarDays className="text-forest h-3.5 w-3.5" />
                  )}
                  {formatGameDate(event.date, { weekday: false })}
                </span>
                <span className="text-muted min-w-0 flex-1 truncate text-[11px]">
                  {event.label ?? (event.kind === "TOURNAMENT" ? "Tournament" : "Game day")}
                </span>
                <span className="text-muted font-mono text-[10px]">
                  {event.played} played · {event.waitlist} waitlist
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmSpec({
                      title: "Remove this attendance list?",
                      description: "Recency scores will be recalculated without it.",
                      confirmLabel: "Remove list",
                      cancelLabel: "Keep it",
                      tone: "danger",
                      onConfirm: () => {
                        startTransition(async () => {
                          const result = await deleteAttendanceEvent(event.id);
                          if (result.ok) {
                            toast.success(result.message ?? "Removed.");
                            router.refresh();
                          } else {
                            toast.error(result.error);
                          }
                        });
                      },
                    })
                  }
                  disabled={pending}
                  className="text-muted hover:bg-coral-soft hover:text-coral grid h-6 w-6 place-items-center rounded-full transition"
                  aria-label="Remove attendance list"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {events.length > RECENT_LISTS && (
          <button
            type="button"
            onClick={() => setShowAllLists((value) => !value)}
            className="text-muted hover:text-ink mt-2 text-[11px] font-semibold transition"
          >
            {showAllLists ? "Show recent only" : `Show all ${events.length} lists`}
          </button>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Log attendance"
        description="Paste the names from the chat list. Numbering, blanks, and headers are ignored."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={pending}>
              <ClipboardPaste className="h-4 w-4" /> Save list
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Type">
              <Select
                value={kind}
                onChange={(event) => setKind(event.target.value as "GAMEDAY" | "TOURNAMENT")}
              >
                <option value="GAMEDAY">Game day</option>
                <option value="TOURNAMENT">Tournament</option>
              </Select>
            </Field>
          </div>
          <Field label="Label" hint="Optional — e.g. “Official MEGA Game Day (KBC)”.">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Game day or tournament name"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Played"
              hint="Paste the whole chat message — a “Waitlist:” section is split out automatically."
            >
              <Textarea
                value={playedText}
                onChange={(event) => setPlayedText(event.target.value)}
                rows={9}
                placeholder={"1. Jgops\n2. Dylan\n3. Shawn"}
              />
            </Field>
            <Field label="Waitlist" hint="Optional. Waitlisting scores lower than playing.">
              <Textarea
                value={waitlistText}
                onChange={(event) => setWaitlistText(event.target.value)}
                rows={9}
                placeholder={"1. Dane\n2. Miles\n3. Dee"}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </Card>
  );
}

function BandCount({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: RecencySnapshot["band"];
}) {
  return (
    <div className="border-line bg-cream/40 flex items-center gap-2 rounded-xl border px-2.5 py-2">
      <span className={cn("grid h-7 w-7 place-items-center rounded-lg border", BAND_STYLES[tone].className)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-base leading-none font-extrabold">{value}</p>
        <p className="text-muted mt-0.5 truncate text-[9px] font-semibold tracking-wide uppercase">{label}</p>
      </div>
    </div>
  );
}
