import { LogOut } from "lucide-react";
import { AppNav, FooterLinks, MobileNav } from "@/components/app/app-nav";
import { Logo, OrgBadge } from "@/components/logo";
import { logoutAction } from "@/lib/actions/auth";
import { InstallAppButton, InstallReminder } from "@/components/install-app";

export function AppShell({
  name,
  admin,
  currentGameDayId,
  children,
}: {
  name: string;
  admin: boolean;
  currentGameDayId: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="bg-forest-deep text-cream relative sticky top-0 hidden h-dvh flex-col overflow-hidden px-4 py-5 lg:flex">
        <div className="court-lines pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="bg-lime/10 pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full blur-3xl" />
        <div className="relative px-1">
          <Logo tone="cream" />
          <div data-trim-id="shell.org-badge">
            <OrgBadge className="mt-5" tone="cream" />
          </div>
          {admin && (
            <span className="border-lime/30 bg-lime/10 text-lime mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] uppercase">
              <span className="bg-lime h-1.5 w-1.5 rounded-full" /> Developer
            </span>
          )}
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <AppNav currentGameDayId={currentGameDayId} />

          <div className="mt-auto space-y-3">
            <div className="border-cream/12 bg-cream/[0.04] rounded-2xl border p-3.5">
              <p className="text-cream/40 text-[9px] font-bold tracking-[0.16em] uppercase">On the board</p>
              <p className="font-display text-cream mt-1 truncate text-sm font-bold">{name}</p>
              <p data-trim-id="shell.session-caption" className="text-cream/45 text-[10px]">
                {admin ? "Developer session" : "Queue master session"}
              </p>
              <InstallAppButton variant="sidebar" className="mt-3" />
              <form action={logoutAction} className="mt-2">
                <button
                  type="submit"
                  className="border-cream/15 text-cream/70 hover:border-lime/50 hover:bg-lime/10 hover:text-lime inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </form>
            </div>
            <div data-trim-id="shell.footer-links">
              <FooterLinks />
            </div>
            <p data-trim-id="shell.credit" className="text-cream/35 px-1 text-[10px] leading-relaxed">
              App by Danyel Regalario
            </p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="glass bg-forest-deep/90 text-cream sticky top-0 z-30 flex h-15 items-center justify-between border-b border-white/5 px-4 lg:hidden">
          <Logo compact tone="cream" />
          <div className="flex items-center gap-2">
            {admin && (
              <span className="border-lime/30 bg-lime/10 text-lime rounded-full border px-2 py-1 text-[9px] font-bold tracking-[0.12em] uppercase">
                Dev
              </span>
            )}
            <InstallAppButton variant="icon" />
            <span className="border-cream/15 bg-cream/5 text-cream/70 max-w-[11rem] truncate rounded-full border px-3 py-1.5 text-[11px] font-semibold">
              {name}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="press border-cream/15 bg-cream/5 text-cream/60 hover:text-lime grid h-9 w-9 place-items-center rounded-full border"
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

      <MobileNav currentGameDayId={currentGameDayId} />
      <InstallReminder />
    </div>
  );
}
