import { beforeEach, describe, expect, it, vi } from "vitest";

const createSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  checkPin: (pin: string) => pin === "1234",
  checkAdminPin: (pin: string) => pin === "9999",
  hasConfiguredAdminPin: () => true,
  clearSession: vi.fn(),
  createSession: (...args: unknown[]) => createSession(...args),
}));

const { loginAction } = await import("./auth");

describe("loginAction", () => {
  beforeEach(() => createSession.mockClear());

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
    expect(createSession).toHaveBeenCalledWith("EJ");
  });

  it("still refuses a wrong PIN", async () => {
    expect((await loginAction("EJ", "0000")).ok).toBe(false);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("keeps the developer name optional", async () => {
    expect((await loginAction("", "9999", "admin")).ok).toBe(true);
    expect(createSession).toHaveBeenCalledWith("Developer", { admin: true });
  });
});
