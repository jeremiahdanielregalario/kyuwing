import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "kyuwing_session";
const SESSION_HOURS = 14;

export type QueueMasterSession = {
  name: string;
  role: "queue_master";
  /** Developer session: can hide/show optional UI pieces for everyone. */
  admin: boolean;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET || "kyuwing-dev-secret-change-before-deploying";
  return new TextEncoder().encode(createHash("sha256").update(secret).digest("hex"));
}

function pinMatches(input: string, expected: string) {
  const inputHash = createHash("sha256").update(input.trim()).digest();
  const expectedHash = createHash("sha256").update(expected.trim()).digest();
  return timingSafeEqual(inputHash, expectedHash);
}

export function hasConfiguredPin() {
  return Boolean(process.env.QUEUE_MASTER_PIN);
}

/** Constant-time queue-master PIN check. Falls back to 1234 for local development only. */
export function checkPin(pin: string): boolean {
  return pinMatches(pin, process.env.QUEUE_MASTER_PIN || "1234");
}

export function hasConfiguredAdminPin() {
  return Boolean(process.env.ADMIN_PIN && process.env.ADMIN_PIN.trim().length >= 4);
}

/**
 * Constant-time developer PIN check. There is deliberately no development
 * fallback: if ADMIN_PIN is unset, developer sign-in stays locked.
 */
export function checkAdminPin(pin: string): boolean {
  const expected = process.env.ADMIN_PIN;
  if (!expected || expected.trim().length < 4) return false;
  return pinMatches(pin, expected);
}

export async function createSession(name: string, options: { admin?: boolean } = {}) {
  const cleanName = name.trim().slice(0, 40) || (options.admin ? "Developer" : "Queue Master");
  const token = await new SignJWT({
    name: cleanName,
    role: "queue_master",
    admin: Boolean(options.admin),
  } satisfies QueueMasterSession)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function getSession(): Promise<QueueMasterSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "queue_master") return null;
    return {
      name: String(payload.name || "Queue Master"),
      role: "queue_master",
      admin: payload.admin === true,
    };
  } catch {
    return null;
  }
}

export async function isQueueMaster(): Promise<boolean> {
  return Boolean(await getSession());
}

/** True only for a session created with the developer PIN. */
export async function isAdmin(): Promise<boolean> {
  return Boolean((await getSession())?.admin);
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
