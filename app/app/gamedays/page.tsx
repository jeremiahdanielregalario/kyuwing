import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Clock3,
  LayoutGrid,
  MapPin,
  Plus,
  Trophy,
  Users,
} from "lucide-react";
import { NewGameDayButton } from "@/components/app/new-game-day";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatGameDate, manilaDateKey, weekdayLabel } from "@/lib/datetime";
import { GAMEDAY_TYPE_LABELS } from "@/lib/fees";
import { getSession } from "@/lib/auth";
import { getGameDays, getVenues } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Game days" };

export default async function GameDaysPage() {
  const [gameDays, venues, session] = await Promise.all([getGameDays(), getVenues(), getSession()]);
  const live = gameDays.filter((gameDay) => gameDay.status === "LIVE");
  const draft = gameDays.filter((gameDay) => gameDay.status === "DRAFT");
  const completed = gameDays.filter((gameDay) => gameDay.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schedule & sessions"
        title="Game days"
        description="Every session lives here. Sign-ups start before the day; the live board takes over when the first player arrives."
        descriptionTrimId="gamedays.description"
        actions={
          <NewGameDayButton
            venues={venues}
            defaultDate={manilaDateKey()}
            defaultQueueMaster={session?.name ?? ""}
          />
        }
      />

      {gameDays.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="No game days yet"
          description="Use New game day above: paste the Messenger list, or pick the venue and add court blocks. Then build the sign-up list."
        />
      ) : (
        <div className="space-y-8">
          {live.length > 0 && (
            <section>
              <SectionHeading title="Live now" count={live.length} tone="live" />
              <div className="grid gap-3 lg:grid-cols-2">
                {live.map((gameDay, index) => (
                  <GameDayCard key={gameDay.id} gameDay={gameDay} index={index} />
                ))}
              </div>
            </section>
          )}

          {draft.length > 0 && (
            <section>
              <SectionHeading title="Drafts & upcoming" count={draft.length} />
              <div className="grid gap-3 lg:grid-cols-2">
                {draft.map((gameDay, index) => (
                  <GameDayCard key={gameDay.id} gameDay={gameDay} index={index} />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <SectionHeading title="Completed" count={completed.length} />
              <div className="grid gap-3 lg:grid-cols-2">
                {completed.map((gameDay, index) => (
                  <GameDayCard key={gameDay.id} gameDay={gameDay} index={index} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div
        data-trim-id="gamedays.info"
        className="border-line bg-paper/60 grid gap-3 rounded-3xl border p-5 sm:grid-cols-3 sm:p-6"
      >
        <Info label="KBC" value="Mondays" note="Kalayaan Badminton Center · 10 AM – 2 PM" />
        <Info label="DASC" value="Saturdays" note="Don Antonio Sports Center · 9 AM – 1 PM" />
        <Info
          label="Types"
          value="Regular · Tipid · MEGA"
          note="Fees are split the same way for every type."
        />
      </div>
    </div>
  );
}

function SectionHeading({ title, count, tone }: { title: string; count: number; tone?: "live" }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      <span className="bg-cream-deep text-muted rounded-full px-2 py-0.5 font-mono text-[10px] font-bold">
        {count}
      </span>
      {tone === "live" && (
        <span className="animate-live-ring ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500 text-emerald-500" />
      )}
    </div>
  );
}

type GameDayRow = Awaited<ReturnType<typeof getGameDays>>[number];

function GameDayCard({ gameDay, index = 0 }: { gameDay: GameDayRow; index?: number }) {
  const date = new Date(gameDay.date);
  const day = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short" }).format(date);
  const statusTone =
    gameDay.status === "LIVE" ? "green" : gameDay.status === "COMPLETED" ? "neutral" : "amber";

  return (
    <div
      className={cn(
        "group bg-paper hover:shadow-card animate-pop-in relative overflow-hidden rounded-3xl border p-4 transition-[box-shadow,translate] duration-300 hover:-translate-y-0.5 sm:p-5",
        gameDay.status === "LIVE" ? "border-forest/30" : "border-line",
      )}
      // Cards arrive one after another rather than all at once.
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "grid h-16 w-16 shrink-0 place-items-center rounded-2xl",
            gameDay.status === "LIVE" ? "bg-forest text-cream" : "bg-cream-deep text-forest",
          )}
        >
          <span className="text-center leading-none">
            <span className="block font-mono text-[9px] font-bold tracking-widest uppercase opacity-60">
              {month}
            </span>
            <span className="font-display mt-1 block text-2xl font-extrabold">{day}</span>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone}>
              {gameDay.status === "LIVE" && (
                <span className="animate-pulse-soft mr-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
              {gameDay.status}
            </Badge>
            <span className="text-muted text-[10px] font-semibold tracking-[0.12em] uppercase">
              {GAMEDAY_TYPE_LABELS[gameDay.type]}
            </span>
          </div>
          <h3 className="font-display mt-1.5 truncate text-lg font-bold tracking-tight">{gameDay.name}</h3>
          <div className="text-muted mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {gameDay.venue.shortName}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> {weekdayLabel(new Date(gameDay.date).getUTCDay())},{" "}
              {formatGameDate(gameDay.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {gameDay._count.players} signed up
            </span>
            <span className="inline-flex items-center gap-1">
              <LayoutGrid className="h-3 w-3" /> {gameDay._count.matches} matches
            </span>
          </div>
        </div>
      </div>

      <div className="border-line/70 mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
        <Link
          href={`/app/gamedays/${gameDay.id}`}
          className={buttonVariants({
            variant: gameDay.status === "COMPLETED" ? "paper" : "primary",
            size: "sm",
          })}
        >
          {gameDay.status === "COMPLETED" ? (
            <Trophy className="h-3.5 w-3.5" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          {gameDay.status === "COMPLETED" ? "View report" : "Open board"}
        </Link>
        <Link href={`/app/gamedays/${gameDay.id}/signups`}>
          <Button variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5" /> Sign-ups
          </Button>
        </Link>
        <Link href={`/app/gamedays/${gameDay.id}/fees`}>
          <Button variant="ghost" size="sm">
            Fees
          </Button>
        </Link>
        <span className="text-muted ml-auto hidden text-[10px] sm:inline">
          {gameDay.status === "COMPLETED" ? (
            <span className="inline-flex items-center gap-1">
              <CircleCheck className="h-3 w-3" /> Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" /> {gameDay.status === "LIVE" ? "In progress" : "Not started"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function Info({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-cream-deep text-forest grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-bold">
        {label}
      </span>
      <div>
        <p className="text-[13px] font-bold">{value}</p>
        <p className="text-muted text-[11px] leading-relaxed">{note}</p>
      </div>
    </div>
  );
}
