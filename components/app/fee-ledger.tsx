"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CircleDollarSign, Download, FileSpreadsheet, FileText, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { markAllPaid, setPayment, setSettled } from "@/lib/actions/gamedays";
import type { FeeReport, FeeRow } from "@/lib/board-types";
import {
  CATEGORY_SHORT,
  GRIP_PRICE,
  PAYMENT_METHOD_LABELS,
  changeDue,
  extrasTotal,
  formatPeso,
} from "@/lib/fees";
import { PaymentCard } from "@/components/payment-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { Stat } from "@/components/ui/stat";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type AnyResult = { ok: true; message?: string } | { ok: false; error: string };

export function FeeLedger({ report }: { report: FeeReport }) {
  const [pending, startTransition] = React.useTransition();
  const [confirmSpec, setConfirmSpec] = React.useState<ConfirmSpec | null>(null);
  const [filter, setFilter] = React.useState<"all" | "unpaid" | "paid">("all");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<FeeRow | null>(null);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<"CASH" | "GCASH" | "BANK" | "OTHER">("CASH");
  const [grips, setGrips] = React.useState("0");
  const [otherCharge, setOtherCharge] = React.useState("");
  const [otherNote, setOtherNote] = React.useState("");
  /** Until the finance member types an amount received, it follows the total. */
  const [amountTouched, setAmountTouched] = React.useState(false);

  // What this player owes with the charges typed in the dialog.
  const dialogExtras = extrasTotal({ gripCount: Number(grips) || 0, otherCharge: Number(otherCharge) || 0 });
  const dialogTotal = selected ? selected.total - selected.extras + dialogExtras : 0;
  const received = Number(amount) || 0;
  const dialogChange = changeDue(dialogTotal, received);
  const dialogBalance = Math.max(0, dialogTotal - received);

  const changeCharges = (nextGrips: string, nextOther: string) => {
    setGrips(nextGrips);
    setOtherCharge(nextOther);
    if (selected && !amountTouched) {
      const extras = extrasTotal({ gripCount: Number(nextGrips) || 0, otherCharge: Number(nextOther) || 0 });
      setAmount(String(selected.total - selected.extras + extras));
    }
  };

  const act = (fn: () => Promise<AnyResult>, onSuccess?: () => void) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        haptic("success");
        toast.success(result.message ?? "Saved.");
        onSuccess?.();
      } else {
        haptic("warning");
        toast.error(result.error);
      }
    });
  };

  const rows = report.rows
    .filter((row) => {
      if (filter === "paid") return row.paid || row.amountPaid > 0;
      if (filter === "unpaid") return !row.paid;
      return true;
    })
    .filter((row) => row.nickname.toLowerCase().includes(query.toLowerCase()));

  const openPayment = (row: FeeRow) => {
    setSelected(row);
    setAmount(String(row.amountPaid || row.total));
    setMethod((row.paymentMethod as typeof method) || "CASH");
    setGrips(String(row.gripCount));
    setOtherCharge(row.otherCharge ? String(row.otherCharge) : "");
    setOtherNote(row.otherNote ?? "");
    setAmountTouched(row.amountPaid > 0);
  };

  const savePayment = () => {
    if (!selected) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    act(
      () =>
        setPayment(selected.sessionPlayerId, {
          paid: value >= dialogTotal,
          amountPaid: value,
          method,
          charges: { gripCount: Number(grips) || 0, otherCharge: Number(otherCharge) || 0, otherNote },
        }),
      () => setSelected(null),
    );
  };

  return (
    <div className="space-y-5">
      <div className="border-line bg-paper rounded-2xl border px-4 py-3 text-[13px] leading-relaxed">
        <p className="text-muted text-[10px] font-bold tracking-[0.14em] uppercase">Split court cost</p>
        <p className="mt-1">
          {report.scheme.split.courtHours} court-hours × {formatPeso(report.scheme.split.ratePerCourtHour)} ={" "}
          <span className="font-semibold">{formatPeso(report.scheme.split.courtCost)}</span> ÷{" "}
          {report.scheme.split.players} players ={" "}
          <span className="font-semibold">{formatPeso(report.scheme.split.flatFee)} each</span>, plus shuttles
          per game. The share changes if more players check in.
        </p>
      </div>

      <PaymentCard />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Total billed"
          value={formatPeso(report.summary.totalBilled)}
          hint={`${report.summary.totalGames} player-games`}
          icon={<CircleDollarSign className="h-4 w-4" />}
          tone="forest"
        />
        <Stat
          label="Collected"
          value={formatPeso(report.summary.totalCollected)}
          hint={`${report.summary.paidPlayers} paid players`}
          icon={<Wallet className="h-4 w-4" />}
          tone="lime"
        />
        <Stat
          label="Outstanding"
          value={formatPeso(report.summary.totalOutstanding)}
          hint={`${report.summary.unpaidPlayers} still to settle`}
          icon={<CircleDollarSign className="h-4 w-4" />}
        />
        <Stat
          label="Players"
          value={report.summary.totalPlayers}
          hint={`${report.summary.totalGames} games logged`}
          icon={<Check className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="border-line bg-paper inline-flex rounded-full border p-1">
          {(
            [
              ["all", "All"],
              ["unpaid", "Unsettled"],
              ["paid", "Paid / partial"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "press rounded-full px-3 py-2 text-[11px] font-semibold",
                filter === value ? "bg-forest text-cream" : "text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-56">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a player…"
            className="h-9 pl-8 text-[12px]"
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {report.summary.totalOutstanding > 0 && (
            <Button
              size="sm"
              variant="paper"
              disabled={pending}
              onClick={() =>
                setConfirmSpec({
                  title: "Mark everyone as paid in full?",
                  description: `${report.rows.length} player fee rows flip to paid. Outstanding balance drops to ₱0.`,
                  confirmLabel: "Mark all paid",
                  cancelLabel: "Not yet",
                  onConfirm: () => act(() => markAllPaid(report.gameDay.id)),
                })
              }
            >
              <Check className="h-3.5 w-3.5" /> Mark all paid
            </Button>
          )}
          <a href={`/api/gamedays/${report.gameDay.id}/export/xlsx`} className="inline-flex">
            <Button size="sm" variant="paper">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
          </a>
          <a href={`/api/gamedays/${report.gameDay.id}/export/pdf`} className="inline-flex">
            <Button size="sm" variant="primary">
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
          </a>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-line/80 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="font-display text-base font-bold">Fee ledger</h2>
            <p data-trim-id="fees.formula" className="text-muted text-[11px]">
              Total = court share + (games × shuttle rate). Court cost split among players.
            </p>
          </div>
          <span className="text-muted inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
            <Download className="h-3 w-3" /> Exports include all players
          </span>
        </div>

        {/* Phones: one tappable card per player; tap to record a payment. */}
        <ul className="divide-line/60 divide-y md:hidden">
          {rows.length === 0 ? (
            <li className="text-muted px-4 py-12 text-center text-[12px]">No players match this view.</li>
          ) : (
            rows.map((row) => (
              <li key={row.sessionPlayerId} className="animate-pop-in flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => openPayment(row)}
                  disabled={pending}
                  className="press flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={`Record payment for ${row.nickname}`}
                >
                  <LevelBadge level={row.level} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold">{row.nickname}</span>
                      <FeeStatus row={row} />
                    </span>
                    <span className="text-muted block text-[10px]">
                      {CATEGORY_SHORT[row.category]} · {row.gamesPlayed} games
                      {row.extras ? ` · extras ${formatPeso(row.extras)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[13px] font-bold">{formatPeso(row.total)}</span>
                    <span
                      className={cn(
                        "block font-mono text-[10px]",
                        row.change > 0 && !row.settled ? "text-coral font-bold" : "text-muted",
                      )}
                    >
                      {row.change > 0
                        ? `change ${formatPeso(row.change)}`
                        : row.balance
                          ? `owes ${formatPeso(row.balance)}`
                          : "settled up"}
                    </span>
                  </span>
                </button>
                <label
                  className="grid h-11 w-9 shrink-0 cursor-pointer place-items-center"
                  title={row.paid ? "Paid and change handed back" : "Not paid in full yet"}
                >
                  <input
                    type="checkbox"
                    checked={row.settled}
                    disabled={pending || !row.paid}
                    onChange={(event) => act(() => setSettled(row.sessionPlayerId, event.target.checked))}
                    aria-label={`${row.nickname} settled`}
                    className="accent-forest h-5 w-5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                  />
                </label>
              </li>
            ))
          )}
        </ul>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[880px] text-left text-[12px]">
            <thead>
              <tr className="border-line bg-cream/50 text-muted border-b text-[9px] tracking-[0.12em] uppercase">
                <th className="px-4 py-2.5 font-bold">Player</th>
                <th className="px-2 py-2.5 text-center font-bold">Games</th>
                <th className="px-2 py-2.5 text-right font-bold">/ Game</th>
                <th className="px-2 py-2.5 text-right font-bold">Extras</th>
                <th className="px-2 py-2.5 text-right font-bold">Total</th>
                <th className="px-2 py-2.5 text-right font-bold">Paid</th>
                <th className="px-2 py-2.5 text-right font-bold">Balance</th>
                <th className="px-2 py-2.5 text-right font-bold">Change</th>
                <th className="px-3 py-2.5 text-right font-bold">Status</th>
                <th className="px-2 py-2.5 text-center font-bold">Settled</th>
                <th className="px-3 py-2.5 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-muted px-4 py-12 text-center">
                    No players match this view.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.sessionPlayerId}
                    className="border-line/50 hover:bg-cream/30 border-b transition"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <LevelBadge level={row.level} />
                        <div>
                          <p className="font-semibold">{row.nickname}</p>
                          <p className="text-muted text-[9px]">{CATEGORY_SHORT[row.category]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center font-mono font-bold">{row.gamesPlayed}</td>
                    <td className="px-2 py-2.5 text-right font-mono">{formatPeso(row.perGameFee)}</td>
                    <td
                      className="px-2 py-2.5 text-right font-mono"
                      title={[
                        row.gripCount ? `${row.gripCount} grip${row.gripCount === 1 ? "" : "s"}` : "",
                        row.otherCharge ? `${row.otherNote || "Other"} ${formatPeso(row.otherCharge)}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      {row.extras ? formatPeso(row.extras) : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-bold">{formatPeso(row.total)}</td>
                    <td className="text-muted px-2 py-2.5 text-right font-mono">
                      {formatPeso(row.amountPaid)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-bold">
                      {row.balance ? formatPeso(row.balance) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2.5 text-right font-mono",
                        row.change > 0 && !row.settled ? "text-coral font-bold" : "text-muted",
                      )}
                    >
                      {row.change ? formatPeso(row.change) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <FeeStatus row={row} />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={row.settled}
                        disabled={pending || !row.paid}
                        onChange={(event) => act(() => setSettled(row.sessionPlayerId, event.target.checked))}
                        aria-label={`${row.nickname} settled`}
                        title={row.paid ? "Paid and change handed back" : "Not paid in full yet"}
                        className="accent-forest h-5 w-5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="paper" onClick={() => openPayment(row)} disabled={pending}>
                        Record
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-line/80 bg-cream/40 flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-[11px]">
          <span className="text-muted">
            {rows.length} of {report.rows.length} players shown
          </span>
          <span className="font-semibold">
            Outstanding:{" "}
            <span className="text-forest font-mono">{formatPeso(report.summary.totalOutstanding)}</span>
          </span>
        </div>
      </Card>

      <p data-trim-id="fees.footer-note" className="text-muted text-[11px] leading-relaxed">
        Different court rate this time? Change <span className="font-semibold">Court rate per hour</span> in
        this game day&apos;s{" "}
        <Link
          href={`/app/gamedays/${report.gameDay.id}/settings`}
          className="text-forest font-semibold underline"
        >
          Settings
        </Link>
        .
      </p>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Record payment · ${selected.nickname}` : "Record payment"}
        description={
          selected ? `${selected.gamesPlayed} games · total ${formatPeso(dialogTotal)}` : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button onClick={savePayment} loading={pending}>
              <Check className="h-4 w-4" /> Save payment
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="border-line bg-cream/40 grid grid-cols-3 gap-2 rounded-2xl border p-3 text-center">
              <div>
                <p className="text-muted text-[9px] tracking-[0.12em] uppercase">Total</p>
                <p className="font-mono text-sm font-bold">{formatPeso(dialogTotal)}</p>
              </div>
              <div>
                <p className="text-muted text-[9px] tracking-[0.12em] uppercase">Received</p>
                <p className="font-mono text-sm font-bold">{formatPeso(received)}</p>
              </div>
              <div>
                <p className="text-muted text-[9px] tracking-[0.12em] uppercase">
                  {dialogChange > 0 ? "Change to give" : "Balance"}
                </p>
                <p className="text-coral font-mono text-sm font-bold">
                  {formatPeso(dialogChange > 0 ? dialogChange : dialogBalance)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Grips" hint={`${formatPeso(GRIP_PRICE)} each`}>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  inputMode="numeric"
                  value={grips}
                  onChange={(event) => changeCharges(event.target.value, otherCharge)}
                />
              </Field>
              <Field label="Other charge" hint="Any extra amount, in pesos">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={otherCharge}
                  placeholder="0"
                  onChange={(event) => changeCharges(grips, event.target.value)}
                />
              </Field>
            </div>
            {(Number(otherCharge) || 0) > 0 && (
              <Field label="What is it for?" hint="Shown on hover in the ledger.">
                <Input
                  value={otherNote}
                  maxLength={60}
                  placeholder="e.g. Shuttle tube, lost key"
                  onChange={(event) => setOtherNote(event.target.value)}
                />
              </Field>
            )}

            <Field
              label="Amount received"
              hint={`Tip: use ${formatPeso(dialogTotal)} to mark it fully paid. If a player hands over more, the change shows up in the ledger until you tick Settled.`}
            >
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(event) => {
                  setAmountTouched(true);
                  setAmount(event.target.value);
                }}
              />
            </Field>
            <Field label="Payment method">
              <Select value={method} onChange={(event) => setMethod(event.target.value as typeof method)}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="paper"
                onClick={() => {
                  setAmountTouched(false);
                  setAmount(String(dialogTotal));
                }}
              >
                Full amount
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAmountTouched(true);
                  setAmount("0");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </div>
  );
}

function FeeStatus({ row }: { row: FeeRow }) {
  if (row.paid) return <Badge tone="green">Paid</Badge>;
  if (row.amountPaid > 0) return <Badge tone="amber">Partial</Badge>;
  return <Badge tone="neutral">Due</Badge>;
}
