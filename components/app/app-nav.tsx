"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, LayoutDashboard, MapPin, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", label: "Live board", short: "Board", icon: LayoutDashboard },
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

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-8 space-y-1">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all",
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

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="border-line bg-paper/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors",
                active ? "text-ink" : "text-muted",
              )}
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full transition-colors",
                  active ? "bg-lime text-forest-deep" : "text-muted",
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
