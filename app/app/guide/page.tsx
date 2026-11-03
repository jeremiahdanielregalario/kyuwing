import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardList,
  Clock3,
  Crosshair,
  HeartHandshake,
  LayoutGrid,
  Link2,
  ListOrdered,
  Play,
  Sparkles,
  Star,
  Timer,
  Trophy,
  UserCheck,
  Users,
  Wallet,
  Wand2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Queue playbook" };

const flow = [
  {
    step: "01",
    icon: CalendarClock,
    title: "Create the game day",
    body: "Venues → pick KBC or DASC → set the date, type, and court blocks. Each block has its own court count, so 3 courts from 9–10 and 4 courts from 10–12 is normal.",
    detail: "Game days → New game day",
    href: "/app/gamedays",
  },
  {
    step: "02",
    icon: Users,
    title: "Build the sign-up list",
    body: "Add players from the database, import a CSV, or add everyone active in one tap. Sign-ups are just a list — nobody is in the queue yet.",
    detail: "Open a game day → Sign-ups",
    href: "/app/players",
  },
  {
    step: "03",
    icon: UserCheck,
    title: "Check in only on arrival",
    body: "When a player is physically at the court, tap Check in. That starts their wait timer and makes them available to the pairing engine.",
    detail: "Board → Check in, or the player's row",
    href: "/app",
  },
  {
    step: "04",
    icon: Wand2,
    title: "Pair the open courts",
    body: "Auto-pair fills every open court with the fairest available foursome. Press it once per wave, or pair a single court from an empty court card.",
    detail: "Board → Auto-pair next games",
    href: "/app",
  },
  {
    step: "05",
    icon: Play,
    title: "Start and finish games",
    body: "Suggested matches become live when players walk on court. Press finish — both teams requeue automatically and games are counted.",
    detail: "Court card → Start → Finish",
    href: "/app",
  },
  {
    step: "06",
    icon: Wallet,
    title: "Settle and export",
    body: "The fee ledger adds flat fee + per-game rate as games finish. Record payments, then download the Excel workbook or PDF for the treasurer.",
    detail: "Fees → Record · Reports → Excel / PDF",
    href: "/app",
  },
];

const rules = [
  {
    icon: Trophy,
    title: "Same bracket first",
    body: "The engine starts with team strength. Four players are split into two teams with the smallest possible level gap.",
  },
  {
    icon: LayoutGrid,
    title: "One bracket up or down",
    body: "A C+ can partner a D- or a B- when the queue needs it. Team totals still have to balance against the other side.",
  },
  {
    icon: Sparkles,
    title: "Cross-border when thin",
    body: "A+ with E is allowed only when there is no better option. The penalty shrinks as the queue gets smaller, so courts keep moving.",
  },
  {
    icon: Timer,
    title: "Wait time matters",
    body: "Longer waits are pushed forward, priority players jump ahead, and players with fewer games are preferred. Everyone gets a turn.",
  },
  {
    icon: Link2,
    title: "Permanent pairs stay together",
    body: "A permanent pair is never split across the net while both are available. The engine only benches them together.",
  },
  {
    icon: HeartHandshake,
    title: "Requests are soft rules",
    body: "Partner and opponent requests are honored when the rest of the match stays fair. The board shows when a request was kept.",
  },
];

const tips = [
  {
    title: "Before the first shuttle",
    items: [
      "Start the game day so the board leaves Draft.",
      "Check the court blocks match the actual booking.",
      "Check in the first four to eight players — no more.",
      "Confirm the court blocks for each time slot.",
    ],
  },
  {
    title: "During the session",
    items: [
      "Check in players as they arrive, not in batches.",
      "Pair only when a court is actually free.",
      "Finish a game before starting the next one on that court.",
      "Use Edit on a court card only for genuine conflicts.",
    ],
  },
  {
    title: "Closing the day",
    items: [
      "Finish or cancel every live and suggested match.",
      "Settle payments in the Fees tab.",
      "Download Excel and PDF for the record.",
      "Complete the game day so it stops polling.",
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Queue master playbook"
        title="Run a smooth game day"
        description="A one-page routine for the person holding the tablet. Follow it top to bottom and the queue basically runs itself."
        descriptionTrimId="guide.description"
        actions={
          <Link href="/app/gamedays" className={buttonVariants({ variant: "primary", size: "sm" })}>
            <CalendarClock className="h-3.5 w-3.5" /> Open game days
          </Link>
        }
      />

      <div data-trim-id="guide.badges" className="flex flex-wrap gap-2">
        <Badge tone="lime">
          <Users className="h-3 w-3" /> No player accounts
        </Badge>
        <Badge tone="outline">
          <Timer className="h-3 w-3" /> Arrival-based queue
        </Badge>
        <Badge tone="outline">
          <Wand2 className="h-3 w-3" /> Auto-balanced doubles
        </Badge>
        <Badge tone="outline">
          <Wallet className="h-3 w-3" /> Automatic fees
        </Badge>
      </div>

      {/* The loop */}
      <section data-trim-id="guide.loop">
        <div className="mb-3 flex items-center gap-2">
          <ListOrdered className="text-forest h-4 w-4" />
          <h2 className="font-display text-xl font-bold tracking-tight">The game-day loop</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {flow.map((item) => (
            <Card
              key={item.step}
              className="group hover:shadow-card flex flex-col p-4 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-muted font-mono text-[10px] font-bold tracking-widest">
                  {item.step}
                </span>
                <span className="bg-cream-deep text-forest group-hover:bg-lime grid h-9 w-9 place-items-center rounded-full transition-colors">
                  <item.icon className="h-4 w-4" />
                </span>
              </div>
              <h3 className="font-display mt-4 text-base font-bold">{item.title}</h3>
              <p className="text-muted mt-1.5 flex-1 text-[12px] leading-relaxed">{item.body}</p>
              <p className="border-line/70 text-forest mt-3 border-t pt-2 font-mono text-[10px]">
                {item.detail}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pairing rules */}
      <section data-trim-id="guide.engine" className="border-line bg-paper rounded-3xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="text-forest h-4 w-4" />
              <h2 className="font-display text-xl font-bold tracking-tight">How the engine thinks</h2>
            </div>
            <p className="text-muted mt-1 max-w-2xl text-[12px] leading-relaxed">
              Every possible foursome and team split gets a cost. The lowest cost wins. These are the weights,
              in plain language.
            </p>
          </div>
          <Badge tone="forest">Lower cost = better match</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((rule) => (
            <div key={rule.title} className="border-line/80 bg-cream/30 rounded-2xl border p-4">
              <span className="bg-paper text-forest ring-line grid h-8 w-8 place-items-center rounded-lg ring-1">
                <rule.icon className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-[13px] font-bold">{rule.title}</h3>
              <p className="text-muted mt-1 text-[11px] leading-relaxed">{rule.body}</p>
            </div>
          ))}
        </div>

        <div className="border-lime-deep/30 bg-lime/15 mt-4 rounded-2xl border p-4">
          <p className="text-forest text-[10px] font-bold tracking-[0.14em] uppercase">Worked example</p>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div>
              <p className="font-display text-lg font-extrabold">C+ · D-</p>
              <p className="text-muted text-[10px]">one bracket apart</p>
            </div>
            <span className="border-line bg-paper text-muted rounded-full border px-2 py-1 font-mono text-[9px]">
              vs
            </span>
            <div>
              <p className="font-display text-lg font-extrabold">B- · D+</p>
              <p className="text-muted text-[10px]">balanced team total</p>
            </div>
          </div>
          <p className="text-muted mt-2 text-[11px] leading-relaxed">
            Both teams total the same level. The engine allows the bracket mix because the match stays
            competitive.
          </p>
        </div>
      </section>

      {/* Requests + permanent pairs */}
      <section data-trim-id="guide.requests" className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <HeartHandshake className="text-forest h-4 w-4" />
            <h2 className="font-display text-base font-bold">Requests</h2>
          </div>
          <p className="text-muted mt-1 text-[12px]">
            Open a player from Sign-ups → Details, or tap the pair icon in the queue.
          </p>
          <ul className="mt-3 space-y-2 text-[12px]">
            <li className="flex items-start gap-2">
              <HeartHandshake className="text-forest mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Partner with</span> — try to put both on the same team.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Crosshair className="text-coral mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Play against</span> — try to put them on opposite teams.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Link2 className="text-forest mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Permanent partner</span> — same team for the whole day.
              </span>
            </li>
          </ul>
          <p className="bg-cream-deep/60 text-muted mt-3 rounded-xl px-3 py-2 text-[11px] leading-relaxed">
            Requests bend, they do not break. If honoring one would create a lopsided game, the engine skips
            it and the board simply does not show the request badge.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Star className="text-forest h-4 w-4" />
            <h2 className="font-display text-base font-bold">Priority & exceptions</h2>
          </div>
          <p className="text-muted mt-1 text-[12px]">
            Use sparingly — priority is visible to everyone on the board.
          </p>
          <ul className="mt-3 space-y-2 text-[12px]">
            <li className="flex items-start gap-2">
              <Star className="fill-lime-deep text-lime-deep mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Priority</span> — a player who has to leave early, or waited
                through a long queue.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Clock3 className="text-muted mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Done</span> — removes them from pairing but keeps their games
                and fees.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="text-forest mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Requeue</span> — brings a Done player back with a fresh wait
                timer.
              </span>
            </li>
          </ul>
          <div className="border-line bg-cream/40 text-muted mt-3 rounded-xl border px-3 py-2 text-[11px] leading-relaxed">
            <span className="text-ink font-semibold">Tip:</span> if the same player keeps getting picked
            first, check that their games count is rising. The engine prefers fewer games played.
          </div>
        </Card>
      </section>

      {/* Checklists */}
      <section data-trim-id="guide.checklists">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="text-forest h-4 w-4" />
          <h2 className="font-display text-xl font-bold tracking-tight">Three checklists</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {tips.map((tip, index) => (
            <Card key={tip.title} className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold">{tip.title}</h3>
                <span className="text-muted font-mono text-[10px] font-bold">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {tip.items.map((item) => (
                  <li key={item} className="text-ink-soft flex items-start gap-2 text-[12px] leading-relaxed">
                    <span className="bg-lime text-forest-deep mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section data-trim-id="guide.faq" className="border-line bg-paper rounded-3xl border px-5 sm:px-6">
        <h2 className="font-display pt-5 text-xl font-bold tracking-tight">Quick answers</h2>
        <div className="divide-line mt-2 divide-y">
          {[
            {
              q: "A player signed up but has not arrived. Do they show in the queue?",
              a: "No. They stay in Expected. Only Check in moves them into Waiting and starts the timer.",
            },
            {
              q: "Two courts are open but I only have six waiting players.",
              a: "Auto-pair fills what it can. Six players becomes one match; four of the remaining two stay queued. Pair again after the next arrival.",
            },
            {
              q: "Can I change a pairing the engine made?",
              a: "Yes. Edit on the court card lets you swap any of the four players or move the match to another court.",
            },
            {
              q: "Someone leaves early. What do I do?",
              a: "Mark them Done. Their games and fees stay; they just stop being paired. Requeue brings them back.",
            },
            {
              q: "How do Tipid and MEGA days differ?",
              a: "Only in the fee table and scale. The board, pairing, and reports work exactly the same way.",
            },
            {
              q: "When should I complete the game day?",
              a: "After the last match is finished and payments are recorded. Completing cancels leftovers and freezes the report.",
            },
          ].map((faq) => (
            <details key={faq.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[13px] font-bold marker:hidden">
                {faq.q}
                <span className="border-line text-muted group-open:border-forest group-open:bg-forest group-open:text-lime grid h-6 w-6 shrink-0 place-items-center rounded-full border transition group-open:rotate-45">
                  <span className="text-base leading-none">+</span>
                </span>
              </summary>
              <p className="text-muted mt-2 max-w-2xl pr-8 text-[12px] leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div
        data-trim-id="guide.footer"
        className="border-line bg-cream-deep/60 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
      >
        <p className="text-muted text-[11px]">
          Still stuck? The board itself is the source of truth — refresh it before assuming something is lost.
        </p>
        <Link href="/app" className={buttonVariants({ variant: "primary", size: "sm" })}>
          Open the board <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
