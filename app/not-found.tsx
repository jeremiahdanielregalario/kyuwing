import Link from "next/link";
import { ArrowLeft, Compass, LayoutGrid, Users } from "lucide-react";
import { BrandMark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="bg-cream grid min-h-dvh place-items-center px-5 py-16">
      <div className="w-full max-w-lg text-center">
        <BrandMark className="mx-auto h-14 w-14" />
        <p className="text-muted mt-6 font-mono text-[11px] font-bold tracking-[0.22em] uppercase">
          404 · Out of bounds
        </p>
        <h1 className="font-display mt-3 text-4xl leading-[0.98] font-extrabold tracking-tight sm:text-5xl">
          That shuttle landed
          <br />
          outside the court.
        </h1>
        <p className="text-muted mx-auto mt-4 max-w-sm text-[13px] leading-relaxed">
          The page you are looking for moved, was deleted, or never existed. Head back to the board and keep
          the queue running.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Link href="/app" className={buttonVariants({ variant: "primary", size: "md" })}>
            <LayoutGrid className="h-4 w-4" /> Open the board
          </Link>
          <Link href="/" className={buttonVariants({ variant: "paper", size: "md" })}>
            <ArrowLeft className="h-4 w-4" /> Public site
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-2 text-left">
          <Link
            href="/app/players"
            className="border-line bg-paper hover:border-forest/40 rounded-2xl border p-3 transition"
          >
            <Users className="text-forest h-4 w-4" />
            <p className="mt-2 text-[12px] font-semibold">Players</p>
            <p className="text-muted text-[10px]">Roster & levels</p>
          </Link>
          <Link
            href="/app/guide"
            className="border-line bg-paper hover:border-forest/40 rounded-2xl border p-3 transition"
          >
            <Compass className="text-forest h-4 w-4" />
            <p className="mt-2 text-[12px] font-semibold">Playbook</p>
            <p className="text-muted text-[10px]">Run a game day</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
