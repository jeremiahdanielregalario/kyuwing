"use client";

import * as React from "react";
import { ArrowRight, RefreshCw, Sparkles, Timer, Users } from "lucide-react";
import { findBestMatch, type PairingHistoryMatch, type PairingPlayer } from "@/lib/pairing";
import { LevelBadge } from "@/components/ui/level-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEMO_POOL: PairingPlayer[] = [
  { id: "p1", nickname: "Jose", level: "A_PLUS", waitMinutes: 6, gamesPlayed: 1 },
  { id: "p2", nickname: "Pat", level: "A", waitMinutes: 18, gamesPlayed: 0 },
  { id: "p3", nickname: "Miggy", level: "A_MINUS", waitMinutes: 31, gamesPlayed: 0 },
  { id: "p4", nickname: "Nico", level: "B_PLUS", waitMinutes: 9, gamesPlayed: 2 },
  { id: "p5", nickname: "Trish", level: "B", waitMinutes: 44, gamesPlayed: 0 },
  { id: "p6", nickname: "Kai", level: "B_MINUS", waitMinutes: 22, gamesPlayed: 1 },
  { id: "p7", nickname: "Luis", level: "C_PLUS", waitMinutes: 12, gamesPlayed: 0 },
  { id: "p8", nickname: "Andrea", level: "C_PLUS", waitMinutes: 37, gamesPlayed: 1 },
  { id: "p9", nickname: "Sam", level: "C_MINUS", waitMinutes: 5, gamesPlayed: 0 },
  { id: "p10", nickname: "Ben", level: "D_PLUS", waitMinutes: 51, gamesPlayed: 0 },
  { id: "p11", nickname: "Jolo", level: "D", waitMinutes: 27, gamesPlayed: 2 },
  { id: "p12", nickname: "Lia", level: "E_PLUS", waitMinutes: 15, gamesPlayed: 0 },
  { id: "p13", nickname: "Mika", level: "BC", waitMinutes: 34, gamesPlayed: 1 },
  { id: "p14", nickname: "Enzo", level: "C_MINUS", waitMinutes: 11, gamesPlayed: 2 },
];

function waitLabel(minutes: number) {
  if (minutes < 1) return "just in";
  if (minutes < 60) return `${minutes}m wait`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function PairingDemo() {
  const [available, setAvailable] = React.useState<PairingPlayer[]>(() => DEMO_POOL.slice(0, 11));
  const [history, setHistory] = React.useState<PairingHistoryMatch[]>([]);
  const [suggestion, setSuggestion] = React.useState(() =>
    findBestMatch(DEMO_POOL.slice(0, 11), [], { round: 1, scarcity: false }),
  );
  const [thinking, setThinking] = React.useState(false);
  const [round, setRound] = React.useState(1);

  const pairNext = () => {
    if (thinking) return;
    setThinking(true);
    window.setTimeout(() => {
      const current =
        suggestion ?? findBestMatch(available, history, { round, scarcity: available.length < 8 });
      let nextHistory = history;
      let nextAvailable = available;

      if (current) {
        nextHistory = [
          ...history,
          {
            round,
            playerIds: current.playerIds,
            team1: current.team1.map((player) => player.id),
            team2: current.team2.map((player) => player.id),
          },
        ];
        nextAvailable = available
          .filter((player) => !current.playerIds.includes(player.id))
          .map((player) => ({ ...player, waitMinutes: player.waitMinutes + 7 }));

        const used = new Set(nextAvailable.map((player) => player.id));
        const bench = DEMO_POOL.filter(
          (player) => !used.has(player.id) && !current.playerIds.includes(player.id),
        );
        while (nextAvailable.length < 8 && bench.length > 0) {
          const next = bench.shift();
          if (next) nextAvailable.push({ ...next, waitMinutes: Math.max(4, next.waitMinutes + round * 2) });
        }
      }

      if (nextAvailable.length < 4) {
        setAvailable(DEMO_POOL.slice(0, 11));
        setHistory([]);
        setRound(1);
        setSuggestion(findBestMatch(DEMO_POOL.slice(0, 11), [], { round: 1 }));
      } else {
        setAvailable(nextAvailable);
        setHistory(nextHistory);
        setRound((value) => value + 1);
        setSuggestion(
          findBestMatch(nextAvailable, nextHistory, {
            round: round + 1,
            scarcity: nextAvailable.length < 8,
          }),
        );
      }
      setThinking(false);
    }, 520);
  };

  const reset = () => {
    setAvailable(DEMO_POOL.slice(0, 11));
    setHistory([]);
    setRound(1);
    setSuggestion(findBestMatch(DEMO_POOL.slice(0, 11), [], { round: 1 }));
    setThinking(false);
  };

  const selected = new Set(suggestion?.playerIds ?? []);
  const onDeck = [...available]
    .filter((player) => !selected.has(player.id))
    .sort((a, b) => b.waitMinutes - a.waitMinutes)
    .slice(0, 3);

  const team1Average = suggestion
    ? Math.round((suggestion.team1.reduce((sum, player) => sum + levelValue(player.level), 0) / 2) * 10) / 10
    : 0;
  const team2Average = suggestion
    ? Math.round((suggestion.team2.reduce((sum, player) => sum + levelValue(player.level), 0) / 2) * 10) / 10
    : 0;

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div
        className="bg-forest absolute -inset-3 -z-10 rotate-[1.6deg] rounded-[2.4rem]"
        aria-hidden="true"
      />
      <div className="bg-lime text-forest-deep shadow-card absolute -top-5 -right-5 z-20 hidden rotate-3 rounded-full px-4 py-2 text-[11px] font-bold tracking-[0.14em] uppercase sm:block">
        Auto-paired
      </div>

      <div className="border-line bg-paper shadow-float relative overflow-hidden rounded-[2rem] border">
        <div className="border-line/80 bg-cream/60 flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="bg-forest text-lime grid h-8 w-8 place-items-center rounded-full">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-muted text-[10px] font-bold tracking-[0.16em] uppercase">
                Court 2 · Round {round}
              </p>
              <p className="font-display text-sm leading-tight font-bold">Next fair match</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-800 uppercase">
            <span className="animate-pulse-soft h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        <div className={cn("p-4 transition-opacity duration-200 sm:p-5", thinking && "opacity-40")}>
          {suggestion ? (
            <div className="space-y-2.5">
              <TeamRow team={suggestion.team1} average={team1Average} tone="dark" />
              <div className="flex items-center gap-3 px-1">
                <div className="bg-line h-px flex-1" />
                <span className="border-line bg-cream text-muted rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.14em] uppercase">
                  vs
                </span>
                <div className="bg-line h-px flex-1" />
              </div>
              <TeamRow team={suggestion.team2} average={team2Average} tone="light" />
            </div>
          ) : (
            <div className="text-muted py-16 text-center text-sm">
              Need at least four players in the queue.
            </div>
          )}

          <div className="border-line/80 bg-cream/60 mt-4 rounded-2xl border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted text-[10px] font-bold tracking-[0.16em] uppercase">
                Team balance
              </span>
              <span className="text-forest font-mono text-[11px] font-bold">
                {suggestion ? `${suggestion.balance} level${suggestion.balance === 1 ? "" : "s"} apart` : "—"}
              </span>
            </div>
            <div className="bg-cream-deep mt-2 h-2 overflow-hidden rounded-full">
              <div
                className="bg-forest h-full rounded-full transition-all duration-500"
                style={{ width: suggestion ? `${Math.max(22, 100 - suggestion.balance * 12)}%` : "0%" }}
              />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {(suggestion?.reasons ?? ["Balanced", "Fresh pairing", "Longest wait"]).map((reason) => (
                <span
                  key={reason}
                  className="border-line bg-paper text-ink-soft rounded-full border px-2 py-1 text-[10px] font-semibold"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={pairNext} className="flex-1" loading={thinking} variant="primary">
              {thinking ? "Balancing…" : "Pair the next four"}
              {!thinking && <ArrowRight className="h-4 w-4" />}
            </Button>
            <Button onClick={reset} variant="paper" size="icon" aria-label="Reset demo">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="border-line/80 bg-cream/50 text-muted flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {available.length} waiting
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" />
            Longest wait {available.length ? Math.max(...available.map((p) => p.waitMinutes)) : 0}m
          </span>
          <span className="font-mono text-[10px] tracking-wide uppercase">
            On deck: {onDeck.map((p) => p.nickname).join(" · ")}
          </span>
        </div>
      </div>

      <div className="border-line bg-paper shadow-card absolute -bottom-7 -left-3 z-20 hidden -rotate-2 items-center gap-2 rounded-2xl border px-3 py-2 sm:flex">
        <span className="bg-lime text-forest grid h-8 w-8 place-items-center rounded-full">
          <Timer className="h-4 w-4" />
        </span>
        <div>
          <p className="text-muted text-[9px] font-bold tracking-[0.14em] uppercase">Arrival timer</p>
          <p className="font-mono text-xs font-bold">00:44:12</p>
        </div>
      </div>
    </div>
  );
}

function TeamRow({
  team,
  average,
  tone,
}: {
  team: PairingPlayer[];
  average: number;
  tone: "dark" | "light";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-2.5",
        tone === "dark" ? "border-forest/20 bg-forest/[0.04]" : "border-line bg-white",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-muted text-[9px] font-bold tracking-[0.16em] uppercase">
          {tone === "dark" ? "Team A" : "Team B"}
        </span>
        <span className="text-muted font-mono text-[9px]">avg {average}</span>
      </div>
      <div className="space-y-1">
        {team.map((player) => (
          <div key={player.id} className="flex items-center gap-2 rounded-lg px-1 py-1">
            <span className="bg-cream-deep font-display text-forest grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold">
              {player.nickname.slice(0, 2).toUpperCase()}
            </span>
            <span className="flex-1 truncate text-[13px] font-semibold">{player.nickname}</span>
            <span className="text-muted hidden text-[10px] sm:inline">{waitLabel(player.waitMinutes)}</span>
            <LevelBadge level={player.level} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Local copy to avoid pulling the server-facing helper into a client bundle.
function levelValue(level: string) {
  const order = [
    "E_MINUS",
    "E",
    "E_PLUS",
    "DE",
    "D_MINUS",
    "D",
    "D_PLUS",
    "CD",
    "C_MINUS",
    "C",
    "C_PLUS",
    "BC",
    "B_MINUS",
    "B",
    "B_PLUS",
    "AB",
    "A_MINUS",
    "A",
    "A_PLUS",
  ];
  return Math.max(0, order.indexOf(level));
}
