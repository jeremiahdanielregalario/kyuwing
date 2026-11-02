import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, Sparkles, Timer, Trophy, Users } from "lucide-react";
import { LoginForm } from "@/components/app/login-form";
import { BrandMark, Logo, OrgBadge } from "@/components/logo";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Queue master login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/app";
  if (session) redirect(next);
  const appHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://badass-kyuwing.vercel.app").host;
    } catch {
      return "badass-kyuwing.vercel.app";
    }
  })();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.08fr]">
      <div className="bg-cream flex flex-col px-5 py-6 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="text-muted hover:text-ink inline-flex items-center gap-1.5 text-[12px] font-semibold transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <OrgBadge className="w-fit" />
          <h1 className="font-brand mt-6 text-3xl leading-[1.02] tracking-tight uppercase sm:text-[2.6rem]">
            Run the room,
            <br />
            not the group chat.
          </h1>
          <p className="text-muted mt-4 text-[14px] leading-relaxed">
            Sign in with the queue master PIN. Players never need an account — this board is yours.
          </p>

          <div className="border-line bg-paper shadow-card mt-8 rounded-3xl border p-5 sm:p-6">
            <LoginForm next={next} showDevHint={process.env.NODE_ENV !== "production"} />
          </div>

          <div className="border-line/70 bg-cream-deep/50 text-muted mt-6 flex items-start gap-2.5 rounded-2xl border p-3.5 text-[11px] leading-relaxed">
            <ShieldCheck className="text-forest mt-0.5 h-4 w-4 shrink-0" />
            <p>
              The PIN only unlocks this browser. For official game days, set a strong{" "}
              <span className="font-mono">QUEUE_MASTER_PIN</span> in the deployment settings and share it only
              with the assigned queue masters.
            </p>
          </div>
        </div>

        <div className="text-muted flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span>App by Danyel Regalario · Built for UP BadAss</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-lime h-1.5 w-1.5 rounded-full" /> Competency · Commitment · Camaraderie
          </span>
        </div>
      </div>

      <div className="bg-forest-deep text-cream relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
        <div className="court-lines absolute inset-0 opacity-40" aria-hidden="true" />
        <div
          className="bg-lime/10 pointer-events-none absolute -top-20 -right-20 h-96 w-96 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between p-10">
          <span className="border-cream/15 bg-cream/5 text-cream/65 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-bold tracking-[0.16em] uppercase">
            <span className="animate-pulse-soft bg-lime h-1.5 w-1.5 rounded-full" />
            Game-day control room
          </span>
          <span className="text-cream/35 font-mono text-[10px] tracking-[0.2em] uppercase">{appHost}</span>
        </div>

        <div className="relative px-10 pb-10">
          <div className="max-w-md">
            <Sparkles className="text-lime h-7 w-7" />
            <p className="font-brand mt-5 text-3xl leading-[1.04] tracking-tight uppercase">
              &ldquo;Four courts. Thirty players. One queue master.&rdquo;
            </p>
            <p className="text-cream/60 mt-4 text-[13px] leading-relaxed">
              Kyuwing keeps the matches balanced, the wait times visible, and the fees honest — while you keep
              the shuttles flying. A premier youth sports organization, one game day at a time.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3">
            {[
              { icon: Trophy, label: "Balanced doubles", value: "Auto" },
              { icon: Timer, label: "Arrival timers", value: "Live" },
              { icon: Users, label: "Players in queue", value: "18" },
              { icon: ShieldCheck, label: "Fee ledger", value: "Ready" },
            ].map((item) => (
              <div key={item.label} className="border-cream/12 bg-cream/[0.04] rounded-2xl border p-4">
                <item.icon className="text-lime/70 h-4 w-4" />
                <p className="font-display mt-4 text-xl font-bold">{item.value}</p>
                <p className="text-cream/45 text-[10px] tracking-[0.12em] uppercase">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="border-cream/12 bg-cream/[0.04] mt-10 flex items-center gap-3 rounded-2xl border p-4">
            <BrandMark className="h-11 w-[4.8rem] shrink-0 px-1.5" />
            <div>
              <p className="font-display text-sm font-bold">UP BadAss</p>
              <p className="text-cream/45 text-[10px]">UP Badminton Association in Diliman · Est. 2015</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
