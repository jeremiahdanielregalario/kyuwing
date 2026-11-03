"use client";

import * as React from "react";
import useSWR from "swr";
import { Clock3, Gift, ListOrdered, MapPin, Search, Users, X } from "lucide-react";
import { CourtLines } from "@/components/app/court-surface";
import { Logo } from "@/components/logo";
import { formatDuration, formatGameDate } from "@/lib/datetime";
import { locatePlayer, type PlayerLocation, type PublicBoard, type PublicMatch } from "@/lib/public-board";
import { cn } from "@/lib/utils";

const NAME_KEY = "kyuwing.live.nickname";
const NAME_EVENT = "kyuwing-live-nickname";

const fetcher = async (url: string): Promise<PublicBoard> => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not refresh the board.");
  return response.json();
};

/** The nickname a player saved on this device, read without a hydration mismatch. */
function useSavedNickname() {
  return React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(NAME_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(NAME_EVENT, onChange);
      };
    },
    () => window.localStorage.getItem(NAME_KEY) ?? "",
    () => "",
  );
}

function saveNickname(value: string) {
  if (value.trim()) window.localStorage.setItem(NAME_KEY, value.trim());
  else window.localStorage.removeItem(NAME_KEY);
  window.dispatchEvent(new Event(NAME_EVENT));
}

export function LiveView({ initialData, endpoint }: { initialData: PublicBoard; endpoint: string }) {
  const { data = initialData, error } = useSWR<PublicBoard>(endpoint, fetcher, {
    fallbackData: initialData,
    refreshInterval: 5000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  // Ticks every second after hydration; 0 on the server so times render as placeholders.
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const kick = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, []);

  const saved = useSavedNickname();
  const [draft, setDraft] = React.useState<string | null>(null);
  const nickname = draft ?? saved;
  const me = saved ? locatePlayer(data, saved) : null;
  const isMe = (name: string) => Boolean(saved) && name.trim().toLowerCase() === saved.trim().toLowerCase();

  const since = (iso: string | null) =>
    iso && now ? formatDuration(Math.max(0, Math.floor((now - Date.parse(iso)) / 1000))) : "--:--";

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
              className={cn("h-1.5 w-1.5 rounded-full", error ? "bg-coral" : "bg-lime animate-pulse-soft")}
            />
            {error ? "Reconnecting" : "Live"}
          </span>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-5">
          <h1 className="font-display text-2xl leading-tight font-extrabold">{data.gameDay.name}</h1>
          <p className="text-cream/60 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {data.gameDay.venue}
            </span>
            <span>{formatGameDate(data.gameDay.date, { weekday: true })}</span>
            {data.gameDay.block && (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" /> {data.gameDay.block}
              </span>
            )}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 pt-5">
        {data.gameDay.status !== "LIVE" && (
          <p className="border-line bg-paper text-muted rounded-2xl border px-4 py-3 text-[13px]">
            {data.gameDay.status === "COMPLETED"
              ? "This game day is over. Thanks for playing!"
              : "The queue opens when the game day starts. Check back at the venue."}
          </p>
        )}

        <section className="border-line bg-paper rounded-2xl border p-4">
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveNickname(nickname);
              setDraft(null);
            }}
          >
            <div className="relative flex-1">
              <Search className="text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                value={nickname}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Your nickname"
                aria-label="Your nickname"
                autoComplete="nickname"
                className="border-line focus:border-forest/50 focus:ring-lime/60 h-11 w-full rounded-xl border bg-white pr-3 pl-9 text-[15px] focus:ring-2 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="bg-forest-deep text-cream h-11 rounded-xl px-4 text-[13px] font-semibold"
            >
              Find me
            </button>
            {saved && (
              <button
                type="button"
                aria-label="Forget my nickname"
                onClick={() => {
                  saveNickname("");
                  setDraft(null);
                }}
                className="text-muted hover:text-ink grid h-11 w-9 place-items-center"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
          {me ? (
            <MyStatus location={me} />
          ) : (
            <p className="text-muted mt-2 text-[12px]">
              Type the nickname the queue master uses to see where you are in line.
            </p>
          )}
        </section>

        <section>
          <SectionTitle icon={<Users className="h-4 w-4" />} title="Courts" />
          <div className="grid gap-3 sm:grid-cols-2">
            {data.courts.map((court) => (
              <CourtTile key={court.name} name={court.name} match={court.match} isMe={isMe} elapsed={since} />
            ))}
          </div>
        </section>

        {data.nextUp.length > 0 && (
          <section>
            <SectionTitle
              icon={<ListOrdered className="h-4 w-4" />}
              title={`Next up · ${data.nextUp.length}`}
              hint="These games take the next courts that free up, in order."
            />
            <ol className="space-y-2">
              {data.nextUp.map((match, index) => (
                <li
                  key={match.id}
                  className={cn(
                    "border-line bg-paper flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                    [...match.team1, ...match.team2].some((player) => isMe(player.nickname)) &&
                      "border-lime ring-lime/50 ring-2",
                  )}
                >
                  <span className="bg-forest text-lime grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-[12px] font-bold">
                    {index + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-[14px] font-semibold">
                    <Names players={match.team1} isMe={isMe} />
                    <span className="text-muted mx-1.5 font-normal">vs</span>
                    <Names players={match.team2} isMe={isMe} />
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section>
          <SectionTitle
            icon={<Clock3 className="h-4 w-4" />}
            title={`Waiting · ${data.waiting.length}`}
            hint="Priority players first, then longest wait. The queue master also balances levels, so the order can shift."
          />
          {data.waiting.length === 0 ? (
            <p className="border-line bg-paper text-muted rounded-2xl border px-4 py-3 text-[13px]">
              No one is waiting right now.
            </p>
          ) : (
            <ol className="border-line bg-paper divide-line/60 divide-y overflow-hidden rounded-2xl border">
              {data.waiting.map((player, index) => (
                <li
                  key={player.nickname}
                  className={cn("flex items-center gap-3 px-3 py-2.5", isMe(player.nickname) && "bg-lime/20")}
                >
                  <span className="text-muted w-6 text-right font-mono text-[12px] font-bold">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                    {player.nickname}
                    {player.priority && (
                      <span className="text-forest ml-1.5 text-[10px] font-bold uppercase">Priority</span>
                    )}
                  </span>
                  <span className="text-muted font-mono text-[11px]">{player.levelLabel}</span>
                  <span className="text-muted w-14 text-right font-mono text-[11px]">
                    {player.gamesPlayed} {player.gamesPlayed === 1 ? "game" : "games"}
                  </span>
                  <span className="w-16 text-right font-mono text-[12px] font-bold">
                    {since(player.waitingSince)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="text-muted pt-2 text-center text-[11px]">
          View only · updates every few seconds · App by Danyel Regalario
        </p>
      </main>
    </div>
  );
}

function MyStatus({ location }: { location: PlayerLocation }) {
  const content: Record<PlayerLocation["kind"], { tone: string; text: React.ReactNode }> = {
    playing: {
      tone: "bg-lime/25 text-forest-deep",
      text: <>You&apos;re playing on {"court" in location && location.court}. Good game!</>,
    },
    called: {
      tone: "bg-lime text-forest-deep",
      text: <>You&apos;re called to {"court" in location && location.court} — head to the court now.</>,
    },
    next: {
      tone: "bg-lime text-forest-deep",
      text:
        "position" in location && location.position === 1 ? (
          <>You&apos;re next! Your game takes the next court that frees up — stay close.</>
        ) : (
          <>You&apos;re in Next up game #{"position" in location && location.position}. Get ready.</>
        ),
    },
    waiting: {
      tone: "bg-cream-deep text-ink",
      text: (
        <>
          You&apos;re waiting — #{"position" in location && location.position} of{" "}
          {"total" in location && location.total} in line.
        </>
      ),
    },
    expected: {
      tone: "bg-amber-50 text-amber-900",
      text: "You're signed up but not checked in. Check in with the queue master.",
    },
    done: { tone: "bg-cream-deep text-muted", text: "You're marked done for the day." },
    missing: {
      tone: "bg-amber-50 text-amber-900",
      text: "That nickname isn't on today's board. Check the spelling, or ask the queue master.",
    },
  };
  const { tone, text } = content[location.kind];
  return <p className={cn("mt-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold", tone)}>{text}</p>;
}

function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="mb-2">
      <h2 className="font-display inline-flex items-center gap-1.5 text-base font-bold">
        {icon} {title}
      </h2>
      {hint && <p className="text-muted text-[11px]">{hint}</p>}
    </div>
  );
}

function Names({ players, isMe }: { players: PublicMatch["team1"]; isMe: (name: string) => boolean }) {
  return (
    <>
      {players.map((player, index) => (
        <React.Fragment key={player.nickname}>
          {index > 0 && " & "}
          <span className={cn(isMe(player.nickname) && "bg-lime/60 rounded px-1")}>{player.nickname}</span>
        </React.Fragment>
      ))}
    </>
  );
}

function CourtTile({
  name,
  match,
  isMe,
  elapsed,
}: {
  name: string;
  match: PublicMatch | null;
  isMe: (name: string) => boolean;
  elapsed: (iso: string | null) => string;
}) {
  const live = match?.status === "LIVE";
  const mine = match ? [...match.team1, ...match.team2].some((player) => isMe(player.nickname)) : false;
  return (
    <div
      className={cn(
        "court-surface relative overflow-hidden rounded-2xl border",
        live ? "border-lime/45" : match ? "border-lime/20" : "border-cream/20 border-dashed",
        mine && "ring-lime ring-2",
      )}
    >
      <CourtLines tone={live ? "live" : match ? "suggested" : "open"} />
      <div className="relative p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-cream/80 font-mono text-[11px] font-bold tracking-[0.16em] uppercase">
            {name}
          </span>
          <span className="flex items-center gap-1.5">
            {match?.free && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-900 uppercase">
                <Gift className="h-2.5 w-2.5" /> Free
              </span>
            )}
            {live && (
              <span className="text-lime font-mono text-[10px] font-bold">{elapsed(match.startedAt)}</span>
            )}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase",
                live
                  ? "bg-lime text-forest-deep"
                  : match
                    ? "border-lime/40 bg-lime/10 text-lime border"
                    : "border-cream/25 text-cream/60 border",
              )}
            >
              {live ? "Playing" : match ? "Called" : "Open"}
            </span>
          </span>
        </div>
        {match ? (
          <div className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1">
            {[match.team1, match.team2].map((team, teamIndex) => (
              <div key={teamIndex} className="space-y-1">
                {team.map((player) => (
                  <p
                    key={player.nickname}
                    className={cn(
                      "text-cream truncate rounded-lg px-2 py-1 text-[14px] font-semibold",
                      isMe(player.nickname) ? "bg-lime text-forest-deep" : "bg-cream/10",
                    )}
                  >
                    {player.nickname}
                    <span className="ml-1.5 font-mono text-[10px] opacity-60">{player.levelLabel}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-cream/50 mt-3 text-[12px]">Waiting for the next game.</p>
        )}
      </div>
    </div>
  );
}
