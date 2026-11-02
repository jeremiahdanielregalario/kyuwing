import { LogOut } from "lucide-react";
import { AppNav, FooterLinks, MobileNav } from "@/components/app/app-nav";
import { Logo, OrgBadge } from "@/components/logo";
import { logoutAction } from "@/lib/actions/auth";

export function AppShell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="border-line bg-cream/70 sticky top-0 hidden h-dvh flex-col border-r px-4 py-5 backdrop-blur-xl lg:flex">
        <div className="px-1">
          <Logo />
          <OrgBadge className="mt-5" />
        </div>

        <AppNav />

        <div className="mt-auto space-y-3">
          <div className="border-line bg-paper rounded-2xl border p-3.5">
            <p className="text-muted text-[9px] font-bold tracking-[0.16em] uppercase">On the board</p>
            <p className="font-display mt-1 truncate text-sm font-bold">{name}</p>
            <p className="text-muted text-[10px]">Queue master session</p>
            <form action={logoutAction} className="mt-3">
              <button
                type="submit"
                className="border-line text-ink-soft hover:border-coral/40 hover:bg-coral-soft inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition hover:text-[#a8331a]"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </form>
          </div>
          <FooterLinks />
          <p className="text-muted/80 px-1 text-[10px] leading-relaxed">App by Danyel Regalario</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-line bg-cream/90 sticky top-0 z-30 flex h-15 items-center justify-between border-b px-4 backdrop-blur-xl lg:hidden">
          <Logo compact />
          <div className="flex items-center gap-2">
            <span className="border-line bg-paper text-ink-soft max-w-[11rem] truncate rounded-full border px-3 py-1.5 text-[11px] font-semibold">
              {name}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="border-line bg-paper text-muted hover:text-coral grid h-9 w-9 place-items-center rounded-full border transition"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-24 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
