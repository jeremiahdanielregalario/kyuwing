"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDollarSign, Download, FileSpreadsheet, FileText, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { markAllPaid, setPayment } from "@/lib/actions/gamedays";
import type { FeeReport, FeeRow } from "@/lib/board-types";
import { CATEGORY_SHORT, PAYMENT_METHOD_LABELS, formatPeso } from "@/lib/fees";
import { PaymentCard } from "@/components/payment-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

type AnyResult = { ok: true; message?: string } | { ok: false; error: string };

export function FeeLedger({ report }: { report: FeeReport }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirmSpec, setConfirmSpec] = React.useState<ConfirmSpec | null>(null);
  const [filter, setFilter] = React.useState<"all" | "unpaid" | "paid">("all");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<FeeRow | null>(null);
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState<"CASH" | "GCASH" | "BANK" | "OTHER">("CASH");

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
          paid: value >= selected.total,
          amountPaid: value,
          method,
        }),
      () => setSelected(null),
    );
  };

  return (
    <div className="space-y-5">
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
                "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
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
              Total = flat fee + (games × per-game rate). {report.gameDay.type} rates ·{" "}
              {report.gameDay.venue.shortName}.
            </p>
          </div>
          <span className="text-muted inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
            <Download className="h-3 w-3" /> Exports include all players
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-[12px]">
            <thead>
              <tr className="border-line bg-cream/50 text-muted border-b text-[9px] tracking-[0.12em] uppercase">
                <th className="px-4 py-2.5 font-bold">Player</th>
                <th className="px-2 py-2.5 text-center font-bold">Games</th>
                <th className="px-2 py-2.5 text-right font-bold">Flat</th>
                <th className="px-2 py-2.5 text-right font-bold">/ Game</th>
                <th className="px-2 py-2.5 text-right font-bold">Total</th>
                <th className="px-2 py-2.5 text-right font-bold">Paid</th>
                <th className="px-2 py-2.5 text-right font-bold">Balance</th>
                <th className="px-3 py-2.5 text-right font-bold">Status</th>
                <th className="px-3 py-2.5 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-muted px-4 py-12 text-center">
                    No players match this view.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const partial = row.amountPaid > 0 && !row.paid;
                  return (
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
                      <td className="px-2 py-2.5 text-right font-mono">{formatPeso(row.flatFee)}</td>
                      <td className="px-2 py-2.5 text-right font-mono">{formatPeso(row.perGameFee)}</td>
                      <td className="px-2 py-2.5 text-right font-mono font-bold">{formatPeso(row.total)}</td>
                      <td className="text-muted px-2 py-2.5 text-right font-mono">
                        {formatPeso(row.amountPaid)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono font-bold">
                        {row.balance ? formatPeso(row.balance) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {row.paid ? (
                          <Badge tone="green">Paid</Badge>
                        ) : partial ? (
                          <Badge tone="amber">Partial</Badge>
                        ) : (
                          <Badge tone="neutral">Due</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button size="sm" variant="paper" onClick={() => openPayment(row)} disabled={pending}>
                          Record
                        </Button>
                      </td>
                    </tr>
                  );
                })
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
        Need to change a rate? Go to{" "}
        <a href="/app/venues" className="text-forest font-semibold underline">
          Venues &amp; fees
        </a>
        . Rate changes apply to the whole game-day type, not just this session.
      </p>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Record payment · ${selected.nickname}` : "Record payment"}
        description={
          selected ? `${selected.gamesPlayed} games · total ${formatPeso(selected.total)}` : undefined
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
                <p className="font-mono text-sm font-bold">{formatPeso(selected.total)}</p>
              </div>
              <div>
                <p className="text-muted text-[9px] tracking-[0.12em] uppercase">Paid</p>
                <p className="font-mono text-sm font-bold">{formatPeso(selected.amountPaid)}</p>
              </div>
              <div>
                <p className="text-muted text-[9px] tracking-[0.12em] uppercase">Balance</p>
                <p className="text-coral font-mono text-sm font-bold">{formatPeso(selected.balance)}</p>
              </div>
            </div>
            <Field
              label="Amount received"
              hint={`Tip: use ${formatPeso(selected.total)} to mark it fully paid.`}
            >
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
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
              <Button size="sm" variant="paper" onClick={() => setAmount(String(selected.total))}>
                Full amount
              </Button>
              <Button size="sm" variant="paper" onClick={() => setAmount(String(selected.flatFee))}>
                Flat fee only
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAmount("0")}>
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
