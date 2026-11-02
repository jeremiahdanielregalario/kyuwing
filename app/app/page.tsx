import { redirect } from "next/navigation";
import { getCurrentGameDayId } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AppIndexPage() {
  const gameDayId = await getCurrentGameDayId();
  if (gameDayId) redirect(`/app/gamedays/${gameDayId}`);
  redirect("/app/gamedays");
}
