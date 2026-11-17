"use client";

import * as React from "react";
import useSWR from "swr";
import { MapPin, Search, Wallet } from "lucide-react";
import { Logo } from "@/components/logo";
import { Stat } from "@/components/ui/stat";
import { formatClock, formatGameDate } from "@/lib/datetime";
import { formatPeso } from "@/lib/fees";
import type { PublicFeeSheet } from "@/lib/public-fees";
import { cn } from "@/lib/utils";

const fetcher = async (url: string): Promise<PublicFeeSheet> => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not refresh the fees.");
  return response.json();
};

/** Same data apart from when it was read: keeps SWR from redrawing the list every poll. */
const sameSheet = (a: PublicFeeSheet | undefined, b: PublicFeeSheet | undefined) =>
  a === b ||
  (Boolean(a && b) &&
    JSON.stringify({ ...a, generatedAt: "" }) === JSON.stringify({ ...b, generatedAt: "" }));

type Filter = "all" | "unpaid" | "paid";
const FILTER_LABELS: Record<Filter, string> = { all: "All", unpaid: "Not paid", paid: "Paid" };

/**
 * The finance member's view-only fees sheet: what each player owes and has paid, kept up to
 * date while the queue master records payments on the Fees page.
 */
export function FeeSheetView({ initialData, endpoint }: { initialData: PublicFeeSheet; endpoint: string }) {
  const {
    data = initialData,
    error,
    isValidating,
  } = useSWR<PublicFeeSheet>(endpoint, fetcher, {
    fallbackData: initialData,
    refreshInterval: 10000,
    revalidateOnFocus: true,
    keepPreviousData: true,
    compare: sameSheet,
  });
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");

  const needle = query.trim().toLowerCase();
  const lines = data.lines.filter(
    (line) =>
      (filter === "all" || (filter === "paid" ? line.paid : !line.paid)) &&
      (!needle || line.nickname.toLowerCase().includes(needle)),
  );
  const { summary } = data;

  return (
    <div className="min-h-dvh pb-12">
      <header className="bg-forest-deep text-cream">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Logo compact tone="cream" />
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase",
              error ? "border-coral/40 text-coral" : "border-lime/30 bg-lime/10 text-lime",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                error ? "bg-coral" : cn("bg-lime", isValidating && "animate-pulse-soft"),
              )}
            />
            {error ? "Reconnecting" : `Updated ${formatClock(data.generatedAt)}`}
          </span>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-5">
          <p className="text-lime text-[11px] font-bold tracking-[0.16em] uppercase">Fees · view only</p>
          <h1 className="font-display mt-1 text-2xl leading-tight font-extrabold">{data.gameDay.name}</h1>
          <p className="text-cream/60 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {data.gameDay.venue}
            </span>
            <span>{formatGameDate(data.gameDay.date, { weekday: true })}</span>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 pt-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Billed" value={formatPeso(summary.billed)} hint={`${summary.games} games`} />
          <Stat
            label="Collected"
            value={formatPeso(summary.collected)}
            hint={`${summary.paidPlayers} paid`}
            tone="forest"
          />
          <Stat
            label="Outstanding"
            value={formatPeso(summary.outstanding)}
            hint={`${summary.unpaidPlayers} not paid`}
            tone={summary.outstanding > 0 ? "coral" : "paper"}
          />
          <Stat label="Players" value={summary.players} />
        </div>

        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="font-display mr-auto inline-flex items-center gap-1.5 text-base font-bold">
              <Wallet className="h-4 w-4" /> Payments
            </h2>
            <div className="border-line bg-paper inline-flex rounded-full border p-0.5" role="tablist">
              {(["all", "unpaid", "paid"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "press min-h-9 rounded-full px-3 text-[12px] font-semibold",
                    filter === value ? "bg-forest text-cream" : "text-muted",
                  )}
                >
                  {FILTER_LABELS[value]}
                </button>
              ))}
            </div>
          </div>
          <label className="border-line bg-paper mb-2 flex h-11 items-center gap-2 rounded-full border px-3.5">
            <Search className="text-muted h-4 w-4 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a nickname"
              aria-label="Find a nickname"
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            />
          </label>

          {lines.length === 0 ? (
            <p className="border-line bg-paper text-muted rounded-2xl border px-4 py-3 text-[13px]">
              {data.lines.length === 0 ? "No players on this game day yet." : "No one matches."}
            </p>
          ) : (
            <ul className="border-line bg-paper divide-line/60 divide-y overflow-hidden rounded-2xl border">
              {lines.map((line) => (
                <li key={line.nickname} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{line.nickname}</p>
                    <p className="text-muted text-[11px]">
                      {line.games} {line.games === 1 ? "game" : "games"} · {formatPeso(line.fee)}
                      {line.extras > 0 && ` + ${formatPeso(line.extras)} extras`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[14px] font-bold">{formatPeso(line.total)}</p>
                    <p
                      className={cn(
                        "text-[11px] font-semibold",
                        line.paid ? "text-forest" : line.balance > 0 ? "text-coral" : "text-muted",
                      )}
                    >
                      {line.paid
                        ? `Paid${line.method ? ` · ${line.method}` : ""}${line.change > 0 && !line.settled ? ` · change ${formatPeso(line.change)}` : ""}`
                        : line.amountPaid > 0
                          ? `${formatPeso(line.amountPaid)} paid · ${formatPeso(line.balance)} left`
                          : line.total > 0
                            ? "Not paid"
                            : "Nothing due"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-muted text-[11px] leading-relaxed">
          This page refreshes on its own. Payments are recorded by the queue master on the board; this sheet
          can&apos;t change anything. Payments taken on a tablet without signal show here once it reconnects.
        </p>
      </main>
    </div>
  );
}
