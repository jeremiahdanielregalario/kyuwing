import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "kyuwing_session";
const SESSION_HOURS = 14;

export type QueueMasterSession = {
  name: string;
  role: "queue_master";
};

function getSecret() {
  const secret = process.env.AUTH_SECRET || "kyuwing-dev-secret-change-before-deploying";
  return new TextEncoder().encode(createHash("sha256").update(secret).digest("hex"));
}

export function hasConfiguredPin() {
  return Boolean(process.env.QUEUE_MASTER_PIN);
}

/** Constant-time PIN check. Falls back to 1234 for local development only. */
export function checkPin(pin: string): boolean {
  const expected = process.env.QUEUE_MASTER_PIN || "1234";
  const inputHash = createHash("sha256").update(pin.trim()).digest();
  const expectedHash = createHash("sha256").update(expected.trim()).digest();
  return timingSafeEqual(inputHash, expectedHash);
}

export async function createSession(name: string) {
  const cleanName = name.trim().slice(0, 40) || "Queue Master";
  const token = await new SignJWT({ name: cleanName, role: "queue_master" } satisfies QueueMasterSession)
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
    return { name: String(payload.name || "Queue Master"), role: "queue_master" };
  } catch {
    return null;
  }
}

export async function isQueueMaster(): Promise<boolean> {
  return Boolean(await getSession());
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
