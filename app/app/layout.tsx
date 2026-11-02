import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Queue board" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/app");
  return <AppShell name={session.name}>{children}</AppShell>;
}
