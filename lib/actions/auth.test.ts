import { beforeEach, describe, expect, it, vi } from "vitest";

const createSession = vi.fn();
const getSession = vi.fn();
const clearSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  SESSION_HOURS: 14,
  checkPin: (pin: string) => pin === "1234",
  checkAdminPin: (pin: string) => pin === "9999",
  hasConfiguredAdminPin: () => true,
  clearSession: () => clearSession(),
  createSession: (...args: unknown[]) => createSession(...args),
  getSession: () => getSession(),
  sessionName: (name: string, admin = false) => name.trim() || (admin ? "Developer" : "Queue Master"),
}));

const create = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    signInLog: { create: (args: unknown) => create(args), updateMany: (args: unknown) => updateMany(args) },
  },
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1" }),
}));
const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

const { loginAction, logoutAction } = await import("./auth");

describe("loginAction", () => {
  beforeEach(() => {
    createSession.mockClear();
    create.mockReset().mockResolvedValue({ id: "log1" });
    updateMany.mockReset().mockResolvedValue({ count: 1 });
    getSession.mockReset().mockResolvedValue(null);
  });

  it("requires a name for the queue master, even with the right PIN", async () => {
    for (const name of ["", "   "]) {
      const result = await loginAction(name, "1234");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/name/i);
    }
    expect(createSession).not.toHaveBeenCalled();
  });

  it("signs the queue master in with a name and the right PIN", async () => {
    expect((await loginAction("EJ", "1234")).ok).toBe(true);
    expect(createSession).toHaveBeenCalledWith("EJ", { admin: false, sid: "log1" });
  });

  it("logs the sign-in with the name, device and when it runs out", async () => {
    await loginAction("EJ", "1234");
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: "EJ", developer: false, device: "iPhone · Safari" });
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(13.9 * 3600 * 1000);
  });

  it("closes the device's previous sign-in when someone signs in again", async () => {
    getSession.mockResolvedValue({ name: "Old", sid: "old1" });
    await loginAction("EJ", "1234");
    expect(updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "old1", signedOutAt: null },
      data: { endReason: "SIGNED_IN_AGAIN" },
    });
  });

  it("still signs in when the log cannot be written", async () => {
    create.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await loginAction("EJ", "1234")).ok).toBe(true);
    expect(createSession).toHaveBeenCalledWith("EJ", { admin: false, sid: undefined });
    spy.mockRestore();
  });

  it("still refuses a wrong PIN", async () => {
    expect((await loginAction("EJ", "0000")).ok).toBe(false);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("keeps the developer name optional", async () => {
    expect((await loginAction("", "9999", "admin")).ok).toBe(true);
    expect(createSession).toHaveBeenCalledWith("Developer", { admin: true, sid: "log1" });
    expect(create.mock.calls[0][0].data).toMatchObject({ developer: true });
  });

  it("does not log a wrong PIN as a sign-in", async () => {
    await loginAction("EJ", "0000");
    expect(create).not.toHaveBeenCalled();
  });
});

describe("logoutAction", () => {
  it("records the sign-out on the session's log entry", async () => {
    getSession.mockResolvedValue({ name: "EJ", sid: "log1" });
    updateMany.mockReset().mockResolvedValue({ count: 1 });
    await logoutAction();
    expect(updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "log1", signedOutAt: null },
      data: { endReason: "SIGNED_OUT" },
    });
    expect(clearSession).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
