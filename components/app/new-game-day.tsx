"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { createGameDay } from "@/lib/actions/gamedays";
import { courtName, parseCourtNumbers } from "@/lib/datetime";
import { gameTime, MEGA_EXTRA_MINUTES, shiftPlanEnd } from "@/lib/court-plan";
import { Button } from "@/components/ui/button";
import { CourtRateField } from "@/components/app/court-rate-field";
import { CourtPlanEditor } from "@/components/app/court-plan-editor";
import { SignupTextPanel } from "@/components/app/signup-text-panel";
import type { SignupCheck } from "@/lib/signup-check";
import { officerNames } from "@/lib/signup-text";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

type VenueOption = {
  id: string;
  name: string;
  shortName: string;
  defaultStart: string;
  defaultEnd: string;
  defaultCourts: number;
};

/** `numbers` is what the queue master typed, e.g. "5, 6, 7, 8" or "5-8". */
type Slot = { id: string; label: string; start: string; end: string; courts: number; numbers: string };

function makeSlot(venue: VenueOption, start = venue.defaultStart, end = venue.defaultEnd): Slot {
  const game = gameTime(start, end);
  return {
    id: `slot-${Date.now()}`,
    label: "First block",
    start: game.start,
    end: game.end,
    courts: venue.defaultCourts,
    numbers: "",
  };
}

export function NewGameDayButton({
  venues,
  defaultDate,
  defaultQueueMaster = "",
}: {
  venues: VenueOption[];
  defaultDate: string;
  /** The signed-in queue master's name, as a starting point. */
  defaultQueueMaster?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const firstVenue = venues[0];
  const [venueId, setVenueId] = React.useState(firstVenue?.id ?? "");
  const [date, setDate] = React.useState(defaultDate);
  const [type, setType] = React.useState("REGULAR");
  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [queueMasterName, setQueueMasterName] = React.useState(defaultQueueMaster);
  const [financeMemberName, setFinanceMemberName] = React.useState("");
  const [courtRate, setCourtRate] = React.useState("");
  // The Messenger sign-up list, when the game day is started from one.
  const [listText, setListText] = React.useState("");
  const [listCheck, setListCheck] = React.useState<SignupCheck | null>(null);
  const appliedHeader = React.useRef("");
  const listBlocked = Boolean(listText.trim()) && !listCheck?.ready;
  const listPlayers = listCheck?.ready ? listCheck.lines.filter((line) => !line.waitlist).length : 0;
  const [slots, setSlots] = React.useState<Slot[]>(firstVenue ? [makeSlot(firstVenue)] : []);
  const [pending, startTransition] = React.useTransition();

  const selectedVenue = venues.find((venue) => venue.id === venueId) ?? firstVenue;

  const changeVenue = (id: string) => {
    setVenueId(id);
    const venue = venues.find((item) => item.id === id);
    if (venue) {
      const fresh = [makeSlot(venue)];
      setSlots(type === "MEGA" ? shiftPlanEnd(fresh, MEGA_EXTRA_MINUTES) : fresh);
    }
  };

  // A MEGA game day starts with one more court hour than a regular one; switching back takes
  // it away again. Either way the queue master can adjust the times afterwards.
  const changeType = (next: string) => {
    if (next === "MEGA" && type !== "MEGA") setSlots(shiftPlanEnd(slots, MEGA_EXTRA_MINUTES));
    else if (next !== "MEGA" && type === "MEGA") setSlots(shiftPlanEnd(slots, -MEGA_EXTRA_MINUTES));
    setType(next);
  };

  // Fill the form from the list's header (venue, date, type, times, QM and FIN) when it changes.
  const applyList = (check: SignupCheck | null) => {
    setListCheck(check);
    if (!check) {
      appliedHeader.current = "";
      return;
    }
    const header = check.header;
    // Every QM / FIN line counts: two QMs fill the field as "Roniel & Jgops".
    const roleName = (role: "QM" | "FIN") =>
      officerNames(
        check.lines.filter((line) => line.status === "ok"),
        role,
      );
    const key = JSON.stringify([
      header.title,
      header.type,
      header.venueId,
      header.date,
      header.start,
      header.end,
    ]);
    if (key !== appliedHeader.current) {
      appliedHeader.current = key;
      const venue = venues.find((item) => item.id === header.venueId) ?? selectedVenue;
      if (header.venueId) setVenueId(header.venueId);
      if (header.date) setDate(header.date);
      setType(header.type);
      if (header.title) setName(header.title);
      if (venue) {
        setSlots([makeSlot(venue, header.start ?? venue.defaultStart, header.end ?? venue.defaultEnd)]);
      }
    }
    const qm = roleName("QM");
    const fin = roleName("FIN");
    if (qm) setQueueMasterName(qm);
    if (fin) setFinanceMemberName(fin);
  };

  const submit = () => {
    if (!selectedVenue) {
      toast.error("Create a venue first.");
      return;
    }
    startTransition(async () => {
      const result = await createGameDay({
        name,
        venueId,
        date,
        type,
        notes,
        queueMasterName,
        financeMemberName,
        signupText: listText.trim() ? listText : null,
        courtRatePerHour: courtRate ? Number(courtRate) : null,
        courtPlan: slots.map(({ numbers, ...slot }) => {
          const courtLabels = parseCourtNumbers(numbers);
          return courtLabels.length ? { ...slot, courts: courtLabels.length, courtLabels } : slot;
        }),
      });
      if (result.ok && result.data) {
        toast.success(result.message ?? "Game day created.");
        setOpen(false);
        router.push(`/app/gamedays/${result.data.id}/signups`);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  };

  if (venues.length === 0) {
    return (
      <Button disabled variant="paper">
        <CalendarPlus className="h-4 w-4" /> Create a venue first
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" /> New game day
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Set up a game day"
        description="One setup, then add your sign-ups and run the board."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {listBlocked && (
              <span className="text-muted mr-auto text-[11px]">Fix the names in the list first.</span>
            )}
            <Button onClick={submit} loading={pending} disabled={listBlocked}>
              <CalendarPlus className="h-4 w-4" /> Create game day
              {listPlayers > 0 && ` · ${listPlayers} players`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <details className="border-line bg-paper group rounded-2xl border" open={Boolean(listText)}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-semibold">
              <ClipboardPaste className="h-4 w-4" />
              Start from the Messenger list
              <span className="text-muted ml-1 text-[11px] font-normal">
                Paste it and the game day and its players are filled in for you.
              </span>
            </summary>
            <div className="border-line border-t p-4">
              <SignupTextPanel text={listText} onTextChange={setListText} onChecked={applyList} />
            </div>
          </details>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Venue">
              <Select value={venueId} onChange={(event) => changeVenue(event.target.value)}>
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
              <Select value={type} onChange={(event) => changeType(event.target.value)}>
                <option value="REGULAR">Regular</option>
                <option value="TIPID">Tipid (court fee only)</option>
                <option value="MEGA">MEGA (+1 hour of courts)</option>
              </Select>
            </Field>
          </div>

          <CourtPlanEditor
            blocks={slots}
            onChange={setSlots}
            makeBlock={(from, index) => ({
              ...from,
              id: `slot-${Date.now()}-${index}`,
            })}
            courtsFor={(slot) => {
              const numbered = parseCourtNumbers(slot.numbers).length;
              return { value: numbered || slot.courts, locked: numbered > 0 };
            }}
            renderExtra={(slot, _index, update) => {
              const numbered = parseCourtNumbers(slot.numbers);
              return (
                <label className="mt-2 block">
                  <span className="text-muted mb-1 block text-[10px] font-bold tracking-[0.12em] uppercase">
                    Court numbers (optional)
                  </span>
                  <Input
                    value={slot.numbers}
                    onChange={(event) => update({ numbers: event.target.value })}
                    placeholder="e.g. 5, 6, 7, 8 or 5-8"
                    className="h-10 text-[13px]"
                  />
                  {numbered.length > 0 && (
                    <span className="text-muted mt-1 block font-mono text-[10px]">
                      {numbered
                        .map((_, position) =>
                          courtName(
                            { ...slot, courts: numbered.length, courtLabels: numbered },
                            position + 1,
                          ),
                        )
                        .join(" · ")}
                    </span>
                  )}
                </label>
              );
            }}
            footnote="Court numbers are the ones the venue assigned (the count follows); leave them blank to number courts 1, 2, 3…"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Queue master" hint="Who runs the board. Shown on the report.">
              <Input
                value={queueMasterName}
                onChange={(event) => setQueueMasterName(event.target.value)}
                placeholder="Full name"
                maxLength={60}
              />
            </Field>
            <Field label="Finance member" hint="Who collects fees. Shown on the report.">
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
            venueShortName={selectedVenue?.shortName ?? ""}
          />

          <Field label="Name (optional)" hint="Defaults to venue + date, e.g. KBC · Monday, Nov 2.">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Monday Night Lights"
              maxLength={80}
            />
          </Field>

          <Field label="Notes (optional)">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Court assignments, reminders, fee notes…"
              maxLength={500}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
