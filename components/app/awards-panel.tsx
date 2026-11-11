"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, Medal, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { deleteTournament, saveTournamentAwards } from "@/lib/actions/awards";
import { parseAwardsText } from "@/lib/awards";
import { formatGameDate } from "@/lib/datetime";
import type { TournamentDto } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const PLACEHOLDER = `Level A
Champions: Chons & Jced
Runner-up: PJ & Ben

Level B
Champions: Serafin & JP
Runner-up: Baby & JCB`;

/** Turns saved awards back into the pasted format, so a tournament can be edited. */
function toText(tournament: TournamentDto): string {
  return tournament.divisions
    .map((division) =>
      [
        division.name,
        division.champion.length ? `Champions: ${division.champion.join(" & ")}` : null,
        division.runnerUp.length ? `Runner-up: ${division.runnerUp.join(" & ")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

export function AwardsPanel({
  tournaments,
  nicknames,
  today,
}: {
  tournaments: TournamentDto[];
  nicknames: string[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<TournamentDto | null>(null);
  const [confirmSpec, setConfirmSpec] = React.useState<ConfirmSpec | null>(null);
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined);
  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState(today);
  const [text, setText] = React.useState("");

  const known = React.useMemo(() => new Set(nicknames.map((nick) => nick.trim().toLowerCase())), [nicknames]);
  const preview = React.useMemo(() => parseAwardsText(text), [text]);
  const unknown = preview.divisions.flatMap((division) =>
    division.results.flatMap((result) => result.names.filter((nick) => !known.has(nick.toLowerCase()))),
  );

  const openForm = (tournament?: TournamentDto) => {
    setEditingId(tournament?.id);
    setName(tournament?.name ?? "");
    setDate(tournament ? tournament.date.slice(0, 10) : today);
    setText(tournament ? toText(tournament) : "");
    setViewing(null);
    setOpen(true);
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveTournamentAwards({ id: editingId, name, date, text });
      if (!result.ok) {
        haptic("warning");
        toast.error(result.error);
        return;
      }
      haptic("success");
      toast.success(result.message ?? "Awards saved.");
      setOpen(false);
      router.refresh();
    });
  };

  const remove = (tournament: TournamentDto) =>
    setConfirmSpec({
      title: `Remove ${tournament.name}?`,
      description: "Its champions and runners-up disappear from every player's awards.",
      confirmLabel: "Remove awards",
      cancelLabel: "Keep them",
      tone: "danger",
      onConfirm: () =>
        startTransition(async () => {
          const result = await deleteTournament(tournament.id);
          if (result.ok) {
            haptic("success");
            toast.success(result.message ?? "Removed.");
            setViewing(null);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        }),
    });

  const teams = (tournament: TournamentDto) =>
    tournament.divisions.reduce(
      (sum, division) => sum + (division.champion.length ? 1 : 0) + (division.runnerUp.length ? 1 : 0),
      0,
    );

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold">Tournament awards</h2>
          <p className="text-muted max-w-xl text-[11px]">
            Champions and runners-up of past tournaments. Players with an award get a trophy among their row
            icons below; tap it to see their podiums and partners.
          </p>
        </div>
        <Button size="sm" onClick={() => openForm()}>
          <Plus className="h-3.5 w-3.5" /> Add awards
        </Button>
      </div>

      {tournaments.length === 0 ? (
        <p className="text-muted mt-3 text-[11px]">No tournament awards yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {tournaments.map((tournament) => (
            <li
              key={tournament.id}
              className="border-line/70 bg-cream/40 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2"
            >
              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-semibold">
                <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span className="truncate">{tournament.name}</span>
              </span>
              <span className="text-muted font-mono text-[10px]">
                {formatGameDate(tournament.date, { weekday: false })} · {tournament.divisions.length} levels ·{" "}
                {teams(tournament)} teams
              </span>
              <button
                type="button"
                onClick={() => setViewing(tournament)}
                className="press text-forest hover:bg-lime/25 inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold"
              >
                <Eye className="h-3.5 w-3.5" /> View
              </button>
              <button
                type="button"
                onClick={() => openForm(tournament)}
                className="press text-muted hover:bg-cream-deep hover:text-ink grid h-9 w-9 place-items-center rounded-full"
                aria-label={`Edit ${tournament.name} awards`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(tournament)}
                disabled={pending}
                className="press text-muted hover:bg-coral-soft hover:text-coral grid h-9 w-9 place-items-center rounded-full"
                aria-label={`Remove ${tournament.name} awards`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit tournament awards" : "Add tournament awards"}
        description="Paste the results: a level line, then the champions and runner-up below it. Use official nicknames."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              loading={pending}
              disabled={preview.divisions.length === 0 || preview.errors.length > 0 || unknown.length > 0}
            >
              <Trophy className="h-4 w-4" /> Save awards
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Field label="Tournament" hint="Leave blank to use the first line of the results.">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={preview.title ?? "High Tide 2026"}
              />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Results">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={12}
                placeholder={PLACEHOLDER}
              />
            </Field>
            <div>
              <p className="text-muted mb-1.5 text-[9px] font-bold tracking-[0.14em] uppercase">Preview</p>
              {text.trim() === "" ? (
                <p className="text-muted text-[11px]">The podium shows here as you paste.</p>
              ) : (
                <div className="space-y-2">
                  {preview.errors.map((error) => (
                    <p key={error} className="text-coral text-[11px] font-semibold">
                      {error}
                    </p>
                  ))}
                  {unknown.length > 0 && (
                    <p className="text-coral text-[11px] font-semibold">
                      Not in the player database: {[...new Set(unknown)].join(", ")}
                    </p>
                  )}
                  {preview.divisions.map((division) => (
                    <div
                      key={division.name}
                      className="border-line/70 bg-cream/40 rounded-lg border px-2.5 py-2"
                    >
                      <p className="text-[11px] font-bold">{division.name}</p>
                      {division.results.map((result) => (
                        <p key={result.place} className="flex items-center gap-1.5 text-[11px]">
                          {result.place === "CHAMPION" ? (
                            <Trophy className="h-3 w-3 text-amber-600" />
                          ) : (
                            <Medal className="h-3 w-3 text-stone-500" />
                          )}
                          {result.names.map((nick, index) => (
                            <React.Fragment key={nick}>
                              {index > 0 && <span className="text-muted">&</span>}
                              <span
                                className={cn(
                                  "font-semibold",
                                  !known.has(nick.toLowerCase()) && "text-coral line-through",
                                )}
                              >
                                {nick}
                              </span>
                            </React.Fragment>
                          ))}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? "Tournament"}
        description={viewing ? formatGameDate(viewing.date, { weekday: false }) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => viewing && openForm(viewing)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="ghost" onClick={() => setViewing(null)}>
              Close
            </Button>
          </>
        }
      >
        {viewing && (
          <ul className="space-y-2">
            {viewing.divisions.map((division) => (
              <li key={division.name} className="border-line/70 bg-cream/40 rounded-xl border px-3 py-2">
                <p className="text-[12px] font-bold">{division.name}</p>
                {division.champion.length > 0 && (
                  <p className="mt-1 flex items-center gap-1.5 text-[12px]">
                    <Trophy className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-muted w-20 text-[10px] font-semibold uppercase">Champions</span>
                    <span className="font-semibold">{division.champion.join(" & ")}</span>
                  </p>
                )}
                {division.runnerUp.length > 0 && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px]">
                    <Medal className="h-3.5 w-3.5 text-stone-500" />
                    <span className="text-muted w-20 text-[10px] font-semibold uppercase">Runner-up</span>
                    <span className="font-semibold">{division.runnerUp.join(" & ")}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </Card>
  );
}
