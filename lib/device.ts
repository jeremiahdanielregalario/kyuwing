import "server-only";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { getSession } from "@/lib/auth";
import type { Claimant } from "@/lib/board-lease";
import { deviceLabel } from "@/lib/sign-in-log";

/**
 * A random id for this browser, kept for a year and across sign-ins, so the server can tell
 * which device holds a game day's board (lib/board-lease.ts). Not a secret and not tied to a person.
 */
const DEVICE_COOKIE = "kyuwing_device";
const VALID = /^[A-Za-z0-9-]{8,64}$/;

/** This browser's device id, set now if it has none. Works in server actions and route handlers. */
export async function ensureDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (existing && VALID.test(existing)) return existing;
  const id = randomUUID();
  store.set(DEVICE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return id;
}

/** The signed-in device asking to change a board, for `runOps`. */
export async function currentClaimant(epoch?: number): Promise<Claimant> {
  const [deviceId, session, requestHeaders] = await Promise.all([ensureDeviceId(), getSession(), headers()]);
  return {
    deviceId,
    epoch,
    name: session?.name?.slice(0, 60) ?? null,
    label: deviceLabel(requestHeaders.get("user-agent"))?.slice(0, 60) ?? null,
  };
}
