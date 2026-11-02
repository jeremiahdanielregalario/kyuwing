"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, LayoutDashboard, Settings2, UserRoundPlus, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function GameDayTabs({
  gameDayId,
  counts,
}: {
  gameDayId: string;
  counts?: { signups?: number; due?: number };
}) {
  const pathname = usePathname();
  const base = `/app/gamedays/${gameDayId}`;
  const tabs = [
    { href: base, label: "Queue board", icon: LayoutDashboard, exact: true },
    { href: `${base}/signups`, label: "Sign-ups", icon: UserRoundPlus, badge: counts?.signups },
    { href: `${base}/fees`, label: "Fees", icon: Wallet, badge: counts?.due },
    { href: `${base}/reports`, label: "Reports", icon: FileText },
    { href: `${base}/settings`, label: "Settings", icon: Settings2 },
  ];

  return (
    <div className="hide-scrollbar border-line -mx-4 mb-5 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max items-center gap-1 pb-0">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative inline-flex items-center gap-2 px-3.5 py-3 text-[12px] font-semibold transition-colors",
                active ? "text-forest" : "text-muted hover:text-ink",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-cream-deep text-ink-soft rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold">
                  {tab.badge}
                </span>
              )}
              {active && <span className="bg-forest absolute inset-x-2 -bottom-px h-0.5 rounded-full" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function PlaybookHint() {
  return (
    <Link
      href="/app/guide"
      className="border-line bg-paper text-ink-soft hover:border-forest/40 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition"
    >
      <ClipboardList className="h-3.5 w-3.5" />
      Queue master playbook
    </Link>
  );
}
