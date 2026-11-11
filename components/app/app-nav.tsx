"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, LayoutDashboard, MapPin, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", label: "Live board", short: "Board", icon: LayoutDashboard, liveBoard: true },
  { href: "/app/gamedays", label: "Game days", short: "Days", icon: CalendarDays },
  { href: "/app/players", label: "Players", short: "Players", icon: Users },
  { href: "/app/venues", label: "Venues & fees", short: "Fees", icon: Wallet },
  { href: "/app/guide", label: "Queue playbook", short: "Guide", icon: BookOpen },
];

function isActive(pathname: string, href: string) {
  // "Live board" matches /app and any game-day page (/app/gamedays/{id}/*).
  // "Game days" only matches the list page (/app/gamedays).
  if (href === "/app") {
    return pathname === "/app" || pathname === "/app/" || /^\/app\/gamedays\/[^/]+/.test(pathname);
  }
  if (href === "/app/gamedays") {
    return pathname === "/app/gamedays" || pathname === "/app/gamedays/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ currentGameDayId }: { currentGameDayId: string | null }) {
  const pathname = usePathname();
  return (
    <nav className="mt-8 space-y-1">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        const disabled = item.liveBoard && !currentGameDayId;
        const href = item.liveBoard && currentGameDayId ? `/app/gamedays/${currentGameDayId}` : item.href;

        if (disabled) {
          return (
            <span
              key={item.href}
              title="No active game day"
              className="group flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold opacity-35"
            >
              <span className="bg-cream/10 text-cream/70 grid h-8 w-8 place-items-center rounded-lg transition-colors">
                <item.icon className="h-4 w-4" />
              </span>
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              "press group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold",
              active
                ? "bg-lime text-forest-deep shadow-[0_10px_24px_-16px_rgba(255,214,0,0.9)]"
                : "text-cream/65 hover:bg-cream/10 hover:text-cream",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg transition-colors",
                active
                  ? "bg-forest-deep/10 text-forest-deep"
                  : "bg-cream/10 text-cream/70 group-hover:bg-cream/15",
              )}
            >
              <item.icon className="h-4 w-4" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ currentGameDayId }: { currentGameDayId: string | null }) {
  const pathname = usePathname();
  const activeIndex = navItems.findIndex((item) => isActive(pathname, item.href));
  return (
    <nav className="glass border-line/70 bg-paper/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-24px_rgb(10_10_10/0.5)] lg:hidden">
      <div className="relative mx-auto grid max-w-xl grid-cols-5">
        {/* One gold pill that glides to the active tab. */}
        {activeIndex >= 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 left-0 flex w-1/5 justify-center transition-transform duration-500 ease-(--ease-spring)"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          >
            <span className="bg-lime h-8 w-11 rounded-full shadow-[0_8px_18px_-10px_rgb(201_181_0/0.9)]" />
          </span>
        )}
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          const disabled = item.liveBoard && !currentGameDayId;
          const href = item.liveBoard && currentGameDayId ? `/app/gamedays/${currentGameDayId}` : item.href;

          if (disabled) {
            return (
              <span
                key={item.href}
                title="No active game day"
                className="flex cursor-not-allowed flex-col items-center gap-1 py-2.5 text-[10px] font-semibold opacity-30"
              >
                <span className="text-muted grid h-8 w-11 place-items-center rounded-full">
                  <item.icon className="h-4.5 w-4.5" />
                </span>
                {item.short}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold",
                active ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-11 place-items-center rounded-full transition-colors duration-300",
                  active ? "text-forest-deep" : "text-muted",
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
              </span>
              {item.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function FooterLinks() {
  return (
    <div className="text-cream/45 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
      <Link href="/" className="hover:text-lime transition">
        Public site
      </Link>
      <Link href="/app/venues" className="hover:text-lime inline-flex items-center gap-1 transition">
        <MapPin className="h-3 w-3" /> Venues
      </Link>
    </div>
  );
}
