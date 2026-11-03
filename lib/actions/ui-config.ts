"use server";

import { revalidatePath } from "next/cache";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isTrimId, sanitizeHidden, UI_HIDDEN_SETTING_KEY } from "@/lib/ui-trim";

async function readHidden(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: UI_HIDDEN_SETTING_KEY } });
  return sanitizeHidden(row?.value);
}

async function writeHidden(ids: string[]) {
  const value = sanitizeHidden(ids);
  await prisma.appSetting.upsert({
    where: { key: UI_HIDDEN_SETTING_KEY },
    create: { key: UI_HIDDEN_SETTING_KEY, value },
    update: { value },
  });
  return value;
}

async function adminGuard(): Promise<ActionResult | null> {
  if (!(await isAdmin())) return fail("Developer session expired. Sign in again.");
  return null;
}

/** Public read: every visitor needs to know which optional pieces are hidden. */
export async function getHiddenUiElements(): Promise<string[]> {
  try {
    return await readHidden();
  } catch {
    // A missing settings table should never take the board down.
    return [];
  }
}

/** Developer-only: hide one optional piece for everyone, on every device. */
export async function hideUiElement(id: string): Promise<ActionResult<{ hidden: string[] }>> {
  const authError = await adminGuard();
  if (authError) return authError;
  if (!isTrimId(id)) return fail("That element is not part of the trim registry.");

  const hidden = await readHidden();
  if (!hidden.includes(id)) {
    await writeHidden([...hidden, id]);
    revalidatePath("/app", "layout");
  }
  return ok("Hidden for everyone.", { hidden: hidden.includes(id) ? hidden : [...hidden, id] });
}

/** Developer-only: bring one element back. */
export async function showUiElement(id: string): Promise<ActionResult<{ hidden: string[] }>> {
  const authError = await adminGuard();
  if (authError) return authError;
  if (!isTrimId(id)) return fail("That element is not part of the trim registry.");

  const hidden = await readHidden();
  const next = hidden.filter((entry) => entry !== id);
  if (next.length !== hidden.length) {
    await writeHidden(next);
    revalidatePath("/app", "layout");
  }
  return ok("Element restored.", { hidden: next });
}

/** Developer-only: restore every optional element. */
export async function resetHiddenUiElements(): Promise<ActionResult<{ hidden: string[] }>> {
  const authError = await adminGuard();
  if (authError) return authError;

  await prisma.appSetting.deleteMany({ where: { key: UI_HIDDEN_SETTING_KEY } });
  revalidatePath("/app", "layout");
  return ok("Every element is back.", { hidden: [] });
}
