import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { UiTrimProvider } from "@/components/app/ui-trim";
import { getHiddenUiElements } from "@/lib/actions/ui-config";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Queue board" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, hidden] = await Promise.all([getSession(), getHiddenUiElements()]);
  if (!session) redirect("/login?next=/app");
  return (
    <UiTrimProvider hidden={hidden} admin={session.admin}>
      <AppShell name={session.name} admin={session.admin}>
        {children}
      </AppShell>
    </UiTrimProvider>
  );
}
