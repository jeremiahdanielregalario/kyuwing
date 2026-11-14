"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import {
  SESSION_HOURS,
  checkAdminPin,
  checkPin,
  clearSession,
  createSession,
  getSession,
  hasConfiguredAdminPin,
  sessionName,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deviceLabel, type SignInEnd } from "@/lib/sign-in-log";

export type LoginMode = "master" | "admin";

/** Closes a sign-in in the log. Logging never blocks signing in or out. */
async function endSignIn(sid: string | undefined, reason: SignInEnd) {
  if (!sid) return;
  try {
    await prisma.signInLog.updateMany({
      where: { id: sid, signedOutAt: null },
      data: { signedOutAt: new Date(), endReason: reason },
    });
  } catch (error) {
    console.error("Sign-in log: could not record the sign-out", error);
  }
}

/** Starts a session and logs it for the developer's Sign-in log. */
async function startSession(name: string, admin: boolean) {
  const previous = await getSession();
  await endSignIn(previous?.sid, "SIGNED_IN_AGAIN");

  let sid: string | undefined;
  try {
    const userAgent = (await headers()).get("user-agent");
    const row = await prisma.signInLog.create({
      data: {
        name: sessionName(name, admin),
        developer: admin,
        device: deviceLabel(userAgent)?.slice(0, 60) ?? null,
        expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    sid = row.id;
  } catch (error) {
    console.error("Sign-in log: could not record the sign-in", error);
  }
  await createSession(name, { admin, sid });
}

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
    await startSession(name || "Developer", true);
    return ok("Developer mode unlocked.");
  }

  if (!checkPin(pin)) return fail("That PIN does not match. Try again.");
  await startSession(name, false);
  return ok("Welcome to the board.");
}

export async function logoutAction() {
  const session = await getSession();
  await endSignIn(session?.sid, "SIGNED_OUT");
  await clearSession();
  redirect("/login");
}
