"use server";

import { redirect } from "next/navigation";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { checkPin, clearSession, createSession } from "@/lib/auth";

export async function loginAction(name: string, pin: string): Promise<ActionResult> {
  if (!pin || pin.trim().length === 0) return fail("Enter the queue master PIN.");
  if (!checkPin(pin)) return fail("That PIN does not match. Try again.");
  await createSession(name);
  return ok("Welcome to the board.");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
