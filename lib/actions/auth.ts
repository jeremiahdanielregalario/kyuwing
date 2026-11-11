"use server";

import { redirect } from "next/navigation";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { checkAdminPin, checkPin, clearSession, createSession, hasConfiguredAdminPin } from "@/lib/auth";

export type LoginMode = "master" | "admin";

export async function loginAction(
  name: string,
  pin: string,
  mode: LoginMode = "master",
): Promise<ActionResult> {
  if (mode === "master" && (!name || name.trim().length === 0)) {
    return fail("Enter your name so players know who is running the queue.");
  }
  if (!pin || pin.trim().length === 0) {
    return fail(mode === "admin" ? "Enter the developer PIN." : "Enter the queue master PIN.");
  }

  if (mode === "admin") {
    if (!hasConfiguredAdminPin()) {
      return fail("Developer sign-in is not configured. Set ADMIN_PIN in the deployment settings.");
    }
    if (!checkAdminPin(pin)) return fail("That developer PIN does not match. Try again.");
    await createSession(name || "Developer", { admin: true });
    return ok("Developer mode unlocked.");
  }

  if (!checkPin(pin)) return fail("That PIN does not match. Try again.");
  await createSession(name);
  return ok("Welcome to the board.");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
