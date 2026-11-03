import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { UiTrimProvider } from "@/components/app/ui-trim";
import { getHiddenUiElements } from "@/lib/actions/ui-config";
import { getSession } from "@/lib/auth";
import { getCurrentGameDayId } from "@/lib/queries";

export const metadata = { title: "Queue board" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, hidden, currentGameDayId] = await Promise.all([
    getSession(),
    getHiddenUiElements(),
    getCurrentGameDayId(),
  ]);
  if (!session) redirect("/login?next=/app");
  return (
    <UiTrimProvider hidden={hidden} admin={session.admin}>
      <AppShell name={session.name} admin={session.admin} currentGameDayId={currentGameDayId ?? null}>
        {children}
      </AppShell>
    </UiTrimProvider>
  );
}
