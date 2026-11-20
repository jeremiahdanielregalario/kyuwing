import type { Metadata } from "next";
import Link from "next/link";
import "katex/dist/katex.min.css";
import { ArrowLeft } from "lucide-react";
import { Playbook } from "@/components/app/playbook";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Queue playbook",
  description: "How UP BadAss runs a game day, and the exact formula the queue uses to pair players.",
};

type Props = { searchParams: Promise<{ back?: string | string[] }> };

/** Only links back into a live view, so the parameter can't send people elsewhere. */
function backLink(value: string | string[] | undefined): string | null {
  const path = Array.isArray(value) ? value[0] : value;
  return path && /^\/live\/[\w-]+\/[\w-]+$/.test(path) ? path : null;
}

/** The members' read-only copy of the queue master playbook. Static content only: no player data. */
export default async function PublicPlaybookPage({ searchParams }: Props) {
  const back = backLink((await searchParams).back);

  return (
    <div className="min-h-dvh pb-12">
      <header className="bg-forest-deep text-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Kyuwing home">
            <Logo compact tone="cream" />
          </Link>
          {back ? (
            <Link
              href={back}
              className="press border-lime/30 bg-lime/10 text-lime inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[12px] font-bold"
            >
              <ArrowLeft className="h-4 w-4" /> Back to the live queue
            </Link>
          ) : (
            <Link
              href="/"
              className="press border-cream/20 text-cream/80 hover:text-cream inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[12px] font-semibold"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          )}
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
          <p className="text-lime text-[10px] font-bold tracking-[0.18em] uppercase">UP BadAss · View only</p>
          <h1 className="font-display mt-1 text-3xl leading-tight font-extrabold">Queue playbook</h1>
          <p className="text-cream/60 mt-2 max-w-2xl text-[13px] leading-relaxed">
            How the queue master runs a game day, and how the app decides who plays next. Want the numbers?{" "}
            <a href="#formula" className="text-lime font-semibold underline-offset-2 hover:underline">
              Jump to the math
            </a>
            .
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <Playbook publicView />
        <p className="text-muted pt-8 text-center text-[11px]">View only · App by Danyel Regalario</p>
      </main>
    </div>
  );
}
