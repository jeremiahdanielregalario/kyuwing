import "server-only";

import { revalidatePath } from "next/cache";

/** Pages that show a game day, so the next visit draws fresh data. */
export function refreshGameDay(id: string) {
  revalidatePath("/app");
  revalidatePath("/app/gamedays");
  revalidatePath(`/app/gamedays/${id}`);
  revalidatePath(`/app/gamedays/${id}/signups`);
  revalidatePath(`/app/gamedays/${id}/fees`);
  revalidatePath(`/app/gamedays/${id}/reports`);
  revalidatePath(`/app/gamedays/${id}/settings`);
}

/** Pages that show attendance: the Players page and the public roster. */
export function refreshAttendance() {
  revalidatePath("/app/players");
  revalidatePath("/roster");
}
