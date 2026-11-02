import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  MapPin,
  MoveRight,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Trophy,
  UserCheck,
  Users,
  Wallet,
  Wand2,
} from "lucide-react";
import { BrandMark, Logo } from "@/components/logo";
import { PairingDemo } from "@/components/marketing/pairing-demo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: "01",
    icon: CalendarClock,
    title: "Set the day up",
    body: "Pick the venue, date, game-day type, and how many courts you have in each time block. Add the sign-up list before anyone arrives.",
  },
  {
    number: "02",
    icon: UserCheck,
    title: "Check in arrivals",
    body: "Only players who are actually at the court enter the queue. Every check-in starts a wait timer, so nobody gets skipped.",
  },
  {
    number: "03",
    icon: Wand2,
    title: "Pair the next courts",
    body: "One tap builds balanced doubles for every open court — same bracket first, fresh partners, requests honored where possible.",
  },
  {
    number: "04",
    icon: Wallet,
    title: "Finish and settle",
    body: "End the game with one tap. Players requeue automatically, games are counted, and the fee ledger is ready to export.",
  },
];

const features = [
  {
    icon: Trophy,
    title: "Fair doubles, every time",
    body: "Team strength is the first filter. The engine weighs level gaps, bracket distance, repeat partners, wait time, and games played.",
  },
  {
    icon: Timer,
    title: "Arrival-based queue",
    body: "The queue starts at check-in, not at sign-up. Live timers show exactly how long each player has been waiting.",
  },
  {
    icon: LayoutGrid,
    title: "Court blocks, not guesswork",
    body: "Three courts from 9–10, four from 10–12? Set each block once and the board knows which courts are open right now.",
  },
  {
    icon: Users,
    title: "Requests without chaos",
    body: "Players can request a partner, an opponent, or a permanent pair. The engine treats these as soft rules and explains its choices.",
  },
  {
    icon: CircleDollarSign,
    title: "A ledger that adds itself",
    body: "Flat fee + per-game rate, set by venue and player type. Every finished game updates the amount due automatically.",
  },
  {
    icon: FileSpreadsheet,
    title: "Reports you can send",
    body: "Download the day's matches and fee summary as Excel or PDF. No more reconstructing the session from chat messages.",
  },
];

const rules = [
  {
    number: "01",
    title: "Same bracket first",
    body: "C with C, B with B. The engine looks for four players who can be split into two teams of similar total strength.",
  },
  {
    number: "02",
    title: "One bracket up or down",
    body: "When the queue is thin, a C+ can pair with a D- or a B-. The team totals still need to balance against the other side.",
  },
  {
    number: "03",
    title: "Cross-border only when needed",
    body: "A+ with E is allowed if that is the only way to keep the courts moving — but it is heavily penalised when better options exist.",
  },
];

const faqs = [
  {
    q: "Do players need to make an account?",
    a: "No. Kyuwing is built for the queue master's tablet or phone. Players just show up, say their nickname, and get checked in. The board is the single source of truth for the day.",
  },
  {
    q: "What if someone signs up but arrives late?",
    a: "Sign-ups and the live queue are separate. A player on the sign-up list stays in Expected until the queue master checks them in. Only checked-in players are paired, and their wait timer starts at arrival.",
  },
  {
    q: "Can the queue master change a pairing?",
    a: "Yes. The engine is an assistant, not a gatekeeper. Open a match, swap any of the four players, or move it to another court. Player requests and permanent pairs are respected by the engine automatically.",
  },
  {
    q: "How does the player level database work?",
    a: "Each player has a nickname, a level from E- to A+, and a type (Active, Alumni, or Applicant). You can edit players one by one, or import a CSV/JSON file. Re-importing updates matching nicknames.",
  },
  {
    q: "What are Tipid and MEGA game days?",
    a: "They are first-class game-day types, each with its own fee table. Tipid can charge court fees only (zero per-game), while MEGA can use more courts and longer blocks. The pairing board works the same way.",
  },
  {
    q: "How are fees calculated?",
    a: "Total = flat fee + (games played × per-game rate). The rate depends on venue, game-day type, and player type. Every rate is editable in Venues & fees — the app ships with placeholder values for UP BadAss to replace.",
  },
  {
    q: "Can we export the day's records?",
    a: "Yes. Every game day has an Excel workbook and a PDF report: summary, per-player fees, all matches with times, and payment status. The fee page also prints cleanly.",
  },
  {
    q: "Is it usable on a phone behind the court?",
    a: "The queue board is designed mobile-first: big touch targets, one-tap check-in, one-tap finish, and a bottom navigation bar. It also works offline-ish on flaky venue Wi-Fi — the last loaded board stays visible while it reconnects.",
  },
];

export default function HomePage() {
  return (
    <div className="overflow-x-clip">
      <div className="gold-rule h-1 w-full" aria-hidden="true" />
      <header className="border-line/70 bg-cream/85 sticky top-0 z-50 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
          <Logo />
          <nav className="text-ink-soft hidden items-center gap-7 text-[13px] font-semibold md:flex">
            <a href="#association" className="hover:text-ink transition">
              Association
            </a>
            <a href="#how" className="hover:text-ink transition">
              How it works
            </a>
            <a href="#pairing" className="hover:text-ink transition">
              Pairing
            </a>
            <a href="#fees" className="hover:text-ink transition">
              Fees
            </a>
            <a href="#faq" className="hover:text-ink transition">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
            >
              Queue master
            </Link>
            <Link href="/app" className={buttonVariants({ variant: "primary", size: "sm" })}>
              Open board
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-forest-deep text-cream relative overflow-hidden">
          <div className="court-lines pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
          <div
            className="bg-lime/10 pointer-events-none absolute top-10 -right-32 h-[34rem] w-[34rem] rounded-full blur-3xl"
            aria-hidden="true"
          />
          <div
            className="bg-lime/[0.06] pointer-events-none absolute top-60 -left-40 h-[26rem] w-[26rem] rounded-full blur-3xl"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-14 pb-20 sm:px-6 sm:pt-20 sm:pb-24 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pt-24">
            <div className="animate-rise">
              <span className="border-lime/30 bg-lime/10 text-lime inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-bold tracking-[0.16em] uppercase">
                <span className="animate-pulse-soft bg-lime h-1.5 w-1.5 rounded-full" />
                UP Badminton Association in Diliman · Est. 2015
              </span>
              <h1 className="font-brand text-cream mt-6 text-[2.5rem] leading-[0.95] tracking-tight uppercase sm:text-[3.2rem] lg:text-[3.7rem]">
                Queue less.
                <br />
                <span className="text-lime">Play more.</span>
              </h1>
              <p className="text-cream/70 mt-6 max-w-lg text-[15px] leading-relaxed sm:text-base">
                The game-day board for UP BadAss. Check players in, get balanced doubles on every open court,
                drag a match anywhere it is needed, and close the day with a fee report — not a spreadsheet.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Competency", "Commitment", "Camaraderie"].map((value) => (
                  <span
                    key={value}
                    className="border-cream/15 bg-cream/5 text-cream/70 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] uppercase"
                  >
                    {value}
                  </span>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/app" className={buttonVariants({ variant: "accent", size: "lg" })}>
                  Open the queue board
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#association"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "border-cream/25 text-cream hover:border-lime/60 hover:bg-cream/10",
                  )}
                >
                  Meet UP BadAss
                </a>
              </div>
              <ul className="text-cream/60 mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-medium">
                {["No player accounts", "Works on any phone", "Drag-and-drop courts", "Excel + PDF reports"].map(
                  (item) => (
                    <li key={item} className="inline-flex items-center gap-1.5">
                      <span className="bg-lime text-forest-deep grid h-4 w-4 place-items-center rounded-full">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="animate-rise-delay-1 lg:pl-6">
              <PairingDemo />
            </div>
          </div>
        </section>

        {/* Marquee */}
        <section className="bg-lime text-forest-deep border-y border-black/10 py-4">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-7 gap-y-2 px-5 text-[11px] font-bold tracking-[0.18em] uppercase sm:justify-between">
            {[
              "Balanced doubles",
              "Arrival timers",
              "Court blocks",
              "Drag & drop courts",
              "Permanent pairs",
              "Per-game fees",
              "Excel + PDF",
            ].map((item, index) => (
              <span key={item} className="inline-flex items-center gap-2.5">
                {index > 0 && <span className="bg-forest-deep/40 h-1 w-1 rounded-full" />}
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* Association */}
        <section id="association" className="border-line bg-paper scroll-mt-24 border-b">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-24">
            <div className="max-w-3xl">
              <p className="text-gold-deep text-[11px] font-bold tracking-[0.18em] uppercase">
                The association
              </p>
              <h2 className="font-brand mt-3 text-3xl leading-[1.02] tracking-tight uppercase sm:text-5xl">
                Competency. Commitment.
                <br />
                <span className="text-gold-deep">Camaraderie.</span>
              </h2>
              <p className="text-muted mt-5 max-w-2xl text-[15px] leading-relaxed">
                Founded in 2015, the UP Badminton Association in Diliman is a premier youth sports
                organization and the lone badminton organization at the University of the Philippines Diliman
                — open to undergraduates, master&apos;s students, and PhD students alike. Kyuwing is the board
                that keeps its game days moving.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                {
                  letter: "C",
                  title: "Competency",
                  body: "We train with intent, compete with purpose, and keep raising the level of our game — on and off the court.",
                },
                {
                  letter: "C",
                  title: "Commitment",
                  body: "We show up for practice, for each other, and for the sport. Consistency is how a batch becomes a legacy.",
                },
                {
                  letter: "C",
                  title: "Camaraderie",
                  body: "We are a family first. Every smash, every miss, and every after-game meal is part of the same story.",
                },
              ].map((value) => (
                <div
                  key={value.title}
                  className="border-line bg-cream/60 hover:border-lime-deep/60 group relative overflow-hidden rounded-3xl border p-6 transition-colors"
                >
                  <span
                    className="font-brand text-lime/50 pointer-events-none absolute -top-4 right-4 text-[6rem] leading-none select-none"
                    aria-hidden="true"
                  >
                    {value.letter}
                  </span>
                  <p className="text-gold-deep text-[10px] font-bold tracking-[0.18em] uppercase">
                    Core value
                  </p>
                  <h3 className="font-display mt-2 text-xl font-bold tracking-tight">{value.title}</h3>
                  <p className="text-muted relative mt-2 text-[13px] leading-relaxed">{value.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="border-line bg-cream/60 rounded-3xl border p-6">
                <p className="font-brand text-gold-deep text-lg uppercase">Mission</p>
                <p className="text-ink-soft mt-3 text-[14px] leading-relaxed">
                  To develop our members into holistic individuals dedicated to advocating badminton through
                  practice of the sport and our social responsibility.
                </p>
              </div>
              <div className="border-line bg-cream/60 rounded-3xl border p-6">
                <p className="font-brand text-gold-deep text-lg uppercase">Vision</p>
                <p className="text-ink-soft mt-3 text-[14px] leading-relaxed">
                  A premier youth sports organization that aims to be a forerunner in promoting badminton as a
                  sport.
                </p>
              </div>
            </div>

            <div className="border-line mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border bg-[var(--color-line)] sm:grid-cols-4">
              {[
                ["2015", "Founded"],
                ["100+", "Active members"],
                ["15", "Batches"],
                ["1", "University-wide badminton org"],
              ].map(([value, label]) => (
                <div key={label} className="bg-paper px-5 py-6">
                  <p className="font-brand text-2xl leading-none tracking-tight">{value}</p>
                  <p className="text-muted mt-2 text-[10px] font-bold tracking-[0.14em] uppercase">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-gold-deep text-[11px] font-bold tracking-[0.18em] uppercase">
              The game-day loop
            </p>
            <h2 className="font-display mt-3 text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-5xl">
              Four taps from sign-up to settled.
            </h2>
            <p className="text-muted mt-4 text-[15px] leading-relaxed">
              Built around the way a UP BadAss session actually runs: people trickle in, courts open and
              close, and the queue master is the only person touching the board.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className="group border-line bg-paper hover:border-forest/30 hover:shadow-float relative flex flex-col rounded-3xl border p-5 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted font-mono text-[11px] font-bold tracking-widest">
                    {step.number}
                  </span>
                  <span className="bg-cream-deep text-forest group-hover:bg-lime grid h-10 w-10 place-items-center rounded-full transition-colors">
                    <step.icon className="h-4.5 w-4.5" />
                  </span>
                </div>
                <h3 className="font-display mt-8 text-lg font-bold tracking-tight">{step.title}</h3>
                <p className="text-muted mt-2 text-[13px] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="border-line bg-cream-deep/60 mt-6 flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <span className="bg-forest text-lime mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full">
                <MoveRight className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display font-bold">Designed for a busy court-side tablet.</p>
                <p className="text-muted text-[13px]">
                  Big buttons, one-tap check-in, and no nested menus. If you can run a queue on paper, you can
                  run this.
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Enter the board
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-line bg-paper/70 border-y">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-gold-deep text-[11px] font-bold tracking-[0.18em] uppercase">
                  Everything in one board
                </p>
                <h2 className="font-display mt-3 text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-5xl">
                  The queue master&apos;s entire desk.
                </h2>
              </div>
              <p className="text-muted max-w-sm text-[13px] leading-relaxed">
                No more group chats asking who is next, whose turn it is to sit out, or how much everyone
                owes.
              </p>
            </div>

            <div className="border-line bg-line mt-12 grid gap-px overflow-hidden rounded-3xl border sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group bg-paper hover:bg-cream/50 p-6 transition-colors sm:p-7"
                >
                  <span className="bg-cream-deep text-forest group-hover:bg-lime grid h-11 w-11 place-items-center rounded-2xl transition-colors">
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display mt-5 text-lg font-bold tracking-tight">{feature.title}</h3>
                  <p className="text-muted mt-2 text-[13px] leading-relaxed">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pairing */}
        <section id="pairing" className="bg-forest text-cream relative scroll-mt-24 overflow-hidden">
          <div className="court-lines absolute inset-0 opacity-50" aria-hidden="true" />
          <div
            className="bg-lime/10 pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full blur-3xl"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <p className="text-lime/80 text-[11px] font-bold tracking-[0.18em] uppercase">
                The pairing brain
              </p>
              <h2 className="font-display text-cream mt-3 text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-5xl">
                Fair by design,
                <br />
                not by favor.
              </h2>
              <p className="text-cream/70 mt-5 max-w-md text-[14px] leading-relaxed">
                Kyuwing weighs every possible foursome and split of teams, then picks the fairest available match.
                The result is a fair game, not a random shuffle.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {[
                  "Level gap",
                  "Bracket distance",
                  "Repeat partners",
                  "Wait time",
                  "Games played",
                  "Requests",
                  "Permanent pairs",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="border-cream/15 bg-cream/5 text-cream/75 rounded-full border px-3 py-1.5 text-[11px] font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="border-cream/15 bg-cream/[0.04] mt-10 rounded-2xl border p-5">
                <div className="text-lime/80 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] uppercase">
                  <Sparkles className="h-3.5 w-3.5" />
                  Worked example
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div>
                    <p className="font-display text-lg font-bold">C+ · D-</p>
                    <p className="text-cream/55 text-[11px]">one bracket apart</p>
                  </div>
                  <span className="border-cream/15 text-cream/60 rounded-full border px-2 py-1 font-mono text-[10px]">
                    vs
                  </span>
                  <div>
                    <p className="font-display text-lg font-bold">B- · D+</p>
                    <p className="text-cream/55 text-[11px]">cross-border fill</p>
                  </div>
                </div>
                <p className="text-cream/55 mt-3 text-[11px] leading-relaxed">
                  Allowed when the queue is thin. Both teams are balanced, so the game stays competitive even
                  though the brackets are mixed.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.number}
                  className="group border-cream/12 bg-cream/[0.04] hover:bg-cream/[0.07] flex gap-5 rounded-2xl border p-5 transition-colors sm:p-6"
                >
                  <span className="text-lime/60 font-mono text-[11px] font-bold tracking-widest">
                    {rule.number}
                  </span>
                  <div>
                    <h3 className="font-display text-cream text-lg font-bold">{rule.title}</h3>
                    <p className="text-cream/65 mt-1.5 text-[13px] leading-relaxed">{rule.body}</p>
                  </div>
                </div>
              ))}
              <div className="border-lime/30 bg-lime/10 text-cream/80 flex items-center gap-3 rounded-2xl border px-5 py-4 text-[12px]">
                <span className="bg-lime text-forest-deep grid h-8 w-8 shrink-0 place-items-center rounded-full">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                Every suggestion shows its reasons — balance, fresh pairings, wait time, and honored requests.
              </div>
            </div>
          </div>
        </section>

        {/* Fees */}
        <section id="fees" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div>
              <p className="text-gold-deep text-[11px] font-bold tracking-[0.18em] uppercase">
                Fees, without the math
              </p>
              <h2 className="font-display mt-3 text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-5xl">
                Two venues.
                <br />
                Three player types.
                <br />
                Zero arguments.
              </h2>
              <p className="text-muted mt-5 max-w-md text-[14px] leading-relaxed">
                Kyuwing counts games as they finish, then applies the right flat fee and per-game rate for the
                venue, game-day type, and player type. The exact rates are yours to set.
              </p>
              <div className="border-line bg-paper mt-7 rounded-2xl border p-5">
                <p className="text-muted text-[10px] font-bold tracking-[0.16em] uppercase">The formula</p>
                <p className="text-forest mt-2 font-mono text-sm font-bold">
                  total = flat fee + (games × rate per game)
                </p>
                <p className="text-muted mt-2 text-[12px]">
                  Tipid days can set rate per game to zero. MEGA days can use their own table.
                </p>
              </div>
              <Link
                href="/app/venues"
                className={cn(buttonVariants({ variant: "accent", size: "md" }), "mt-6")}
              >
                Set the fee table
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <VenueCard
                code="KBC"
                name="Kalayaan Badminton Center"
                day="Mondays"
                time="10:00 AM – 2:00 PM"
                courts="3 courts typical"
                tone="lime"
              />
              <VenueCard
                code="DASC"
                name="Don Antonio Sports Center"
                day="Saturdays"
                time="9:00 AM – 1:00 PM"
                courts="4 courts typical"
                tone="cream"
              />
              <div className="border-line bg-paper rounded-3xl border p-5 sm:col-span-2">
                <p className="text-muted text-[10px] font-bold tracking-[0.16em] uppercase">Player types</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Active member", note: "Lowest rate", icon: "01" },
                    { label: "Inactive / Alumni", note: "Higher rate", icon: "02" },
                    { label: "Applicant", note: "Higher rate", icon: "03" },
                  ].map((type) => (
                    <div key={type.label} className="border-line/80 bg-cream/50 rounded-2xl border p-4">
                      <span className="text-muted font-mono text-[10px] font-bold">{type.icon}</span>
                      <p className="mt-2 text-sm font-bold">{type.label}</p>
                      <p className="text-muted text-[11px]">{type.note}</p>
                    </div>
                  ))}
                </div>
                <div className="text-muted mt-4 flex flex-wrap gap-2 text-[11px]">
                  <span className="bg-cream-deep rounded-full px-2.5 py-1">Regular</span>
                  <span className="bg-cream-deep rounded-full px-2.5 py-1">Tipid · court fee only</span>
                  <span className="bg-cream-deep rounded-full px-2.5 py-1">MEGA · custom scale</span>
                </div>
                <p className="text-muted mt-3 text-[11px] leading-relaxed">
                  Placeholder rates are seeded for development. Replace them with the official UP BadAss rates
                  in Venues &amp; fees.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Reports */}
        <section id="reports" className="border-line bg-cream-deep/50 scroll-mt-24 border-y">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
            <div className="order-2 lg:order-1">
              <div className="border-line bg-paper shadow-float rounded-3xl border p-5 sm:p-6">
                <div className="border-line flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="text-muted text-[10px] font-bold tracking-[0.16em] uppercase">
                      Session ledger
                    </p>
                    <p className="font-display text-lg font-bold">KBC · Mon, Nov 2</p>
                  </div>
                  <span className="bg-lime text-forest-deep rounded-full px-2.5 py-1 text-[10px] font-bold">
                    READY
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    ["Jose", "A+", 4, "₱450", true],
                    ["Andrea", "C+", 3, "₱400", true],
                    ["Ben", "D+", 2, "₱350", false],
                    ["Lia", "E+", 1, "₱300", false],
                    ["Nico", "B+", 5, "₱500", true],
                  ].map(([name, level, games, total, paid]) => (
                    <div
                      key={String(name)}
                      className="border-line/70 bg-cream/40 flex items-center gap-3 rounded-xl border px-3 py-2.5"
                    >
                      <span className="bg-cream-deep grid h-8 w-8 place-items-center rounded-full text-[10px] font-bold">
                        {String(name).slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{name}</p>
                        <p className="text-muted text-[10px]">
                          {level} · {games} games
                        </p>
                      </div>
                      <span className="font-mono text-xs font-bold">{total}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[9px] font-bold uppercase",
                          paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900",
                        )}
                      >
                        {paid ? "Paid" : "Due"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-forest text-cream mt-4 flex items-center justify-between rounded-xl px-4 py-3">
                  <span className="text-cream/60 text-[11px] font-semibold tracking-[0.14em] uppercase">
                    Collected
                  </span>
                  <span className="text-lime font-mono text-lg font-bold">₱2,000</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <span className="border-line inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border bg-white py-2 text-[11px] font-semibold">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </span>
                  <span className="border-line inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border bg-white py-2 text-[11px] font-semibold">
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </span>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <p className="text-gold-deep text-[11px] font-bold tracking-[0.18em] uppercase">
                Close the day
              </p>
              <h2 className="font-display mt-3 text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-5xl">
                Walk out with the books closed.
              </h2>
              <p className="text-muted mt-5 max-w-md text-[14px] leading-relaxed">
                Every game is logged with its court, round, and players. The fee page recalculates as
                the day goes, so the final tally is already waiting when the last shuttle drops.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  "Per-player games, wins, and losses",
                  "Flat + per-game fee breakdown by player type",
                  "Paid, partial, and outstanding balances",
                  "Match history with courts and rounds",
                  "Excel workbook and print-ready PDF",
                ].map((item) => (
                  <li key={item} className="text-ink-soft flex items-start gap-2.5 text-[13px]">
                    <span className="bg-lime text-forest-deep mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/app" className={cn(buttonVariants({ variant: "primary", size: "md" }), "mt-7")}>
                See a live board
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-4xl scroll-mt-24 px-5 py-20 sm:px-6 sm:py-28">
          <div className="text-center">
            <p className="text-gold-deep text-[11px] font-bold tracking-[0.18em] uppercase">
              Questions, answered
            </p>
            <h2 className="font-display mt-3 text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-5xl">
              Before you take the board.
            </h2>
          </div>
          <div className="divide-line border-line bg-paper mt-10 divide-y rounded-3xl border px-5 sm:px-7">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="font-display flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-bold marker:hidden">
                  {faq.q}
                  <span className="border-line text-muted group-open:border-forest group-open:bg-forest group-open:text-lime grid h-7 w-7 shrink-0 place-items-center rounded-full border transition group-open:rotate-45">
                    <span className="text-lg leading-none">+</span>
                  </span>
                </summary>
                <p className="text-muted mt-3 max-w-3xl pr-8 text-[13px] leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-forest text-cream relative overflow-hidden">
          <div className="dot-grid absolute inset-0 opacity-40" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-5 py-20 text-center sm:px-6 sm:py-24">
            <div className="border-cream/15 bg-cream/5 text-cream/70 mx-auto flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase">
              <SlidersHorizontal className="text-lime h-3.5 w-3.5" />
              Set up once. Run every game day.
            </div>
            <h2 className="font-display mx-auto mt-6 max-w-3xl text-4xl leading-[0.98] font-extrabold tracking-tight sm:text-6xl">
              The courts are booked.
              <br />
              <span className="text-lime">Let&apos;s run the queue.</span>
            </h2>
            <p className="text-cream/65 mx-auto mt-5 max-w-xl text-[14px] leading-relaxed">
              Built for UP BadAss, by UP BadAss. Open the board, check in the first four, and let the queue
              master enjoy the game too. Competency. Commitment. Camaraderie.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/app" className={buttonVariants({ variant: "accent", size: "lg" })}>
                Open the queue board
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-cream/25 text-cream hover:border-lime/60 hover:bg-cream/10",
                )}
              >
                Queue master login
              </Link>
            </div>
            <p className="text-cream/40 mt-8 text-[11px] tracking-[0.18em] uppercase">
              Kalayaan · Don Antonio · Mondays &amp; Saturdays
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-forest-deep text-cream/70 border-cream/10 border-t">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          <div>
            <Logo tone="cream" />
            <p className="text-cream/55 mt-4 max-w-xs text-[13px] leading-relaxed">
              Fair, fast game-day queueing for the UP Badminton Association, Diliman. Competency. Commitment.
              Camaraderie.
            </p>
            <div className="text-cream/45 mt-5 flex flex-wrap gap-2 text-[10px] tracking-[0.14em] uppercase">
              <span className="border-cream/10 rounded-full border px-2.5 py-1">KBC · Mondays</span>
              <span className="border-cream/10 rounded-full border px-2.5 py-1">DASC · Saturdays</span>
            </div>
          </div>
          <FooterCol
            title="Product"
            links={[
              ["How it works", "#how"],
              ["Pairing", "#pairing"],
              ["Fees", "#fees"],
              ["Reports", "#reports"],
            ]}
          />
          <FooterCol
            title="Open the app"
            links={[
              ["Queue board", "/app"],
              ["Players", "/app/players"],
              ["Venues & fees", "/app/venues"],
              ["Queue master", "/login"],
            ]}
          />
          <div>
            <p className="text-cream/40 text-[10px] font-bold tracking-[0.16em] uppercase">Made for</p>
            <div className="border-cream/10 bg-cream/[0.04] mt-4 flex items-center gap-3 rounded-2xl border p-3">
              <BrandMark className="h-10 w-16 shrink-0 px-1" />
              <div>
                <p className="font-display text-cream text-sm font-bold">UP BadAss</p>
                <p className="text-cream/50 text-[10px]">UP Badminton Association in Diliman</p>
              </div>
            </div>
            <p className="text-cream/45 mt-4 inline-flex items-center gap-1.5 text-[11px]">
              <MapPin className="h-3.5 w-3.5" /> Diliman, Quezon City
            </p>
            <div className="text-cream/45 mt-3 flex items-center gap-3 text-[11px]">
              <a href="https://www.facebook.com/upbadass.official" className="hover:text-lime transition">
                Facebook
              </a>
              <a href="https://www.instagram.com/upbadass" className="hover:text-lime transition">
                Instagram
              </a>
              <a href="https://www.tiktok.com/@upbadass" className="hover:text-lime transition">
                TikTok
              </a>
            </div>
          </div>
        </div>
        <div className="border-cream/10 border-t">
          <div className="text-cream/40 mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>© {new Date().getFullYear()} UP BadAss · App by Danyel Regalario</p>
            <p className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" /> Built for the long queue and the last shuttle.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function VenueCard({
  code,
  name,
  day,
  time,
  courts,
  tone,
}: {
  code: string;
  name: string;
  day: string;
  time: string;
  courts: string;
  tone: "lime" | "cream";
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border p-5",
        tone === "lime" ? "border-lime-deep/40 bg-lime text-forest-deep" : "border-line bg-paper",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="font-display text-2xl font-extrabold tracking-tight">{code}</span>
        <MapPin className="h-4 w-4 opacity-50" />
      </div>
      <p className="mt-1 text-[12px] leading-snug font-semibold">{name}</p>
      <div className="mt-5 space-y-1.5 text-[11px]">
        <p className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" /> {day}
        </p>
        <p className="flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" /> {time}
        </p>
        <p className="flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5" /> {courts}
        </p>
      </div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="text-cream/40 text-[10px] font-bold tracking-[0.16em] uppercase">{title}</p>
      <ul className="mt-4 space-y-2.5 text-[12px]">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-cream/65 hover:text-lime transition">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
