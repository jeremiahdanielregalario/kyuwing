import { LEVELS, bracketOf, isUnrated, levelTone } from "@/lib/levels";
import { cn } from "@/lib/utils";

/** Active players per broad bracket (E to A), shared by the Players tab and the public roster. */
export function BracketSpread({ players }: { players: Array<{ level: string; active: boolean }> }) {
  const active = players.filter((player) => player.active).length;
  const byBracket = ["E", "D", "C", "B", "A"].map((bracket) => ({
    bracket,
    count: players.filter(
      (player) => player.active && !isUnrated(player.level) && bracketOf(player.level) === bracket,
    ).length,
  }));
  const unrated = players.filter((player) => player.active && isUnrated(player.level)).length;
  const maxBracket = Math.max(1, ...byBracket.map((row) => row.count));

  return (
    <div className="border-line bg-paper rounded-3xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold">Bracket spread</h2>
          <p data-trim-id="players.bracket-note" className="text-muted text-[11px]">
            Active players per broad bracket. The pairing engine uses the full 19-level ladder.
          </p>
        </div>
        <span className="text-muted font-mono text-[10px]">
          {LEVELS.length} levels · {active} active
          {unrated > 0 ? ` · ${unrated} not rated yet (X)` : ""}
        </span>
      </div>
      <div className="border-line mt-5 grid grid-cols-5 gap-2 border-b sm:gap-4">
        {byBracket.map((row) => {
          const barPx = row.count === 0 ? 3 : Math.max(12, Math.round((row.count / maxBracket) * 100));
          const tone = levelTone(row.bracket);
          return (
            <div key={row.bracket} className="flex flex-col items-center justify-end" style={{ height: 128 }}>
              <span
                className={cn("mb-1 font-mono text-[12px] leading-none font-bold tabular-nums", tone.text)}
              >
                {row.count}
              </span>
              <div
                className={cn("w-full max-w-16 rounded-t-lg transition-all duration-500", tone.solid)}
                style={{ height: barPx }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2 sm:gap-4">
        {byBracket.map((row) => {
          const tone = levelTone(row.bracket);
          return (
            <div key={row.bracket} className="text-center">
              <span className={cn("font-display text-base font-extrabold", tone.text)}>{row.bracket}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
