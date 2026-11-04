"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ClipboardPaste, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createGameDay } from "@/lib/actions/gamedays";
import { courtName, parseCourtNumbers } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { CourtRateField } from "@/components/app/court-rate-field";
import { SignupTextPanel } from "@/components/app/signup-text-panel";
import type { SignupCheck } from "@/lib/signup-check";
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

function makeSlot(venue: VenueOption, index = 0): Slot {
  return {
    id: `slot-${Date.now()}-${index}`,
    label: index === 0 ? "First block" : `Block ${index + 1}`,
    start: venue.defaultStart,
    end: venue.defaultEnd,
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
    if (venue) setSlots([makeSlot(venue)]);
  };

  // Fill the form from the list's header (venue, date, type, times, QM and FIN) when it changes.
  const applyList = (check: SignupCheck | null) => {
    setListCheck(check);
    if (!check) {
      appliedHeader.current = "";
      return;
    }
    const header = check.header;
    const roleName = (role: "QM" | "FIN") =>
      check.lines.find((line) => line.role === role && line.status === "ok")?.nickname ?? null;
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
        setSlots([
          {
            ...makeSlot(venue),
            start: header.start ?? venue.defaultStart,
            end: header.end ?? venue.defaultEnd,
          },
        ]);
      }
    }
    const qm = roleName("QM");
    const fin = roleName("FIN");
    if (qm) setQueueMasterName(qm);
    if (fin) setFinanceMemberName(fin);
  };

  const addSlot = () => {
    if (!selectedVenue) return;
    setSlots((current) => {
      const previous = current[current.length - 1];
      const nextStart = previous?.end ?? selectedVenue.defaultStart;
      const nextEnd = nextStart === "12:00" ? "14:00" : "15:00";
      return [
        ...current,
        {
          id: `slot-${Date.now()}`,
          label: `Block ${current.length + 1}`,
          start: nextStart,
          end: nextEnd,
          // Courts usually keep their numbers across blocks; start from the previous block's.
          courts: previous?.courts ?? selectedVenue.defaultCourts,
          numbers: previous?.numbers ?? "",
        },
      ];
    });
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
              <Select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="REGULAR">Regular</option>
                <option value="TIPID">Tipid (court fee only)</option>
                <option value="MEGA">MEGA</option>
              </Select>
            </Field>
          </div>

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

          <CourtRateField value={courtRate} onChange={setCourtRate} plan={slots} />

          <Field label="Name (optional)" hint="Defaults to venue + date, e.g. KBC · Monday, Nov 2.">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Monday Night Lights"
              maxLength={80}
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-muted text-[10px] font-bold tracking-[0.14em] uppercase">Court blocks</p>
              <button
                type="button"
                onClick={addSlot}
                className="text-forest inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
              >
                <Plus className="h-3 w-3" /> Add block
              </button>
            </div>
            <div className="space-y-2">
              {slots.map((slot, index) => {
                const numbered = parseCourtNumbers(slot.numbers);
                return (
                  <div key={slot.id} className="border-line bg-cream/30 space-y-2 rounded-xl border p-2.5">
                    <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.2fr_0.8fr_0.8fr_0.6fr_auto]">
                      <Input
                        value={slot.label}
                        onChange={(event) =>
                          setSlots((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, label: event.target.value } : row,
                            ),
                          )
                        }
                        className="h-9 text-[12px]"
                        aria-label="Block label"
                      />
                      <Input
                        type="time"
                        value={slot.start}
                        onChange={(event) =>
                          setSlots((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, start: event.target.value } : row,
                            ),
                          )
                        }
                        className="h-9 text-[12px]"
                        aria-label="Start time"
                      />
                      <Input
                        type="time"
                        value={slot.end}
                        onChange={(event) =>
                          setSlots((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, end: event.target.value } : row,
                            ),
                          )
                        }
                        className="h-9 text-[12px]"
                        aria-label="End time"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={numbered.length || slot.courts}
                        readOnly={numbered.length > 0}
                        title={numbered.length > 0 ? "Set by the court numbers below" : undefined}
                        onChange={(event) =>
                          setSlots((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, courts: Number(event.target.value) } : row,
                            ),
                          )
                        }
                        className="h-9 text-center text-[12px]"
                        aria-label="Court count"
                      />
                      <button
                        type="button"
                        onClick={() => setSlots((current) => current.filter((_, i) => i !== index))}
                        disabled={slots.length === 1}
                        className="text-muted hover:bg-coral-soft hover:text-coral grid h-9 w-9 place-items-center rounded-lg transition disabled:opacity-30"
                        aria-label="Remove block"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={slot.numbers}
                        onChange={(event) =>
                          setSlots((current) =>
                            current.map((row, i) =>
                              i === index ? { ...row, numbers: event.target.value } : row,
                            ),
                          )
                        }
                        placeholder="Court numbers from the venue, e.g. 5, 6, 7, 8 or 5-8"
                        className="h-9 min-w-0 flex-1 text-[12px]"
                        aria-label="Court numbers"
                      />
                      {numbered.length > 0 && (
                        <span className="text-muted font-mono text-[10px]">
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
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-muted mt-1.5 text-[11px]">
              Enter the court numbers the venue assigned — the count follows. Leave them blank to number
              courts 1, 2, 3… Each block can differ, e.g. 3 courts from 9–10, then 4 from 10–12.
            </p>
          </div>

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
