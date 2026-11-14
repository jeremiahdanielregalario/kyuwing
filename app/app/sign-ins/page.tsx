import { notFound } from "next/navigation";
import { LogIn, LogOut, MonitorSmartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { getSession } from "@/lib/auth";
import { manilaDateKey } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { formatSignInTime, signInStatus, signedInFor, type SignInStatus } from "@/lib/sign-in-log";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign-in log" };

const SHOWN = 300;

async function loadSignIns() {
  const rows = await prisma.signInLog.findMany({ orderBy: { signedInAt: "desc" }, take: SHOWN });
  const now = new Date();
  return {
    rows: rows.map((row) => ({ ...row, status: signInStatus(row, now) })),
    now,
  };
}

const STATUS_TONE: Record<SignInStatus["kind"], "green" | "neutral" | "amber" | "outline"> = {
  active: "green",
  "signed-out": "neutral",
  replaced: "outline",
  expired: "amber",
};

/** Developer only: when queue masters (and the developer) signed in and out. */
export default async function SignInsPage() {
  const session = await getSession();
  if (!session?.admin) notFound();

  const { rows, now } = await loadSignIns();
  const active = rows.filter((row) => row.status.kind === "active");
  const today = manilaDateKey(now);
  const signedInToday = rows.filter((row) => manilaDateKey(row.signedInAt) === today).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Developer"
        title="Sign-in log"
        description="When each queue master signed in and out, newest first, in Manila time. Sign-ins end when someone presses Sign out, signs in again on the same device, or after 14 hours. Only the developer can see this page."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Signed in now" value={active.length} hint="Sessions still open" tone="forest" />
        <Stat label="Sign-ins today" value={signedInToday} hint="Since midnight" />
        <Stat label="Logged" value={rows.length} hint={`Latest ${SHOWN} shown`} />
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-muted px-4 py-12 text-center text-[12px]">
            No sign-ins logged yet. They appear here from the next sign-in.
          </p>
        ) : (
          <ul className="divide-line/60 divide-y">
            {rows.map((row) => {
              const end = row.status.kind === "active" ? now : row.status.at;
              return (
                <li key={row.id} className="flex flex-wrap items-start gap-x-4 gap-y-1.5 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold">
                      <span className="truncate">{row.name}</span>
                      {row.developer && <Badge tone="lime">Developer</Badge>}
                      <Badge tone={STATUS_TONE[row.status.kind]}>{row.status.label}</Badge>
                    </p>
                    {row.device && (
                      <p className="text-muted mt-0.5 inline-flex items-center gap-1 text-[11px]">
                        <MonitorSmartphone className="h-3 w-3" /> {row.device}
                      </p>
                    )}
                  </div>
                  <div className="text-[12px] leading-relaxed">
                    <p className="inline-flex items-center gap-1.5">
                      <LogIn className="text-forest h-3.5 w-3.5" />
                      <span className="text-muted">In</span> {formatSignInTime(row.signedInAt)}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <LogOut className="text-muted h-3.5 w-3.5" />
                      <span className="text-muted">
                        {row.status.kind === "active"
                          ? "Still signed in"
                          : row.status.kind === "expired"
                            ? "Timed out"
                            : row.status.kind === "replaced"
                              ? "Signed in again"
                              : "Out"}
                      </span>
                      {row.status.kind !== "active" && formatSignInTime(row.status.at)}
                    </p>
                    <p className="text-muted font-mono text-[10px]">
                      {row.status.kind === "active" ? "for " : ""}
                      {signedInFor(row.signedInAt, end)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
