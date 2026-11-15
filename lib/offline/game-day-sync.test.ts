import { afterEach, describe, expect, it, vi } from "vitest";
import { syncLabel } from "@/components/app/use-offline-game-day";
import { applyOps, type BoardOp } from "@/lib/board-engine/ops";
import { blankSignup } from "@/lib/board-engine/players";
import type { EngineState } from "@/lib/board-engine/types";
import { GameDaySync, type SyncStatus } from "./game-day-sync";

const DAY = Date.UTC(2026, 10, 14);

function fixture(): EngineState {
  return {
    gameDay: {
      id: "gd1",
      name: "Saturday",
      date: new Date(DAY).toISOString(),
      type: "REGULAR",
      status: "LIVE",
      courtPlan: [{ id: "s1", label: "Morning", start: "08:00", end: "12:00", courts: 2 }],
      notes: null,
      queueMasterName: null,
      financeMemberName: null,
      courtRatePerHour: 300,
      courtHoursOverride: null,
      startedAt: DAY,
      completedAt: null,
      venue: { id: "v1", name: "DASC", shortName: "DASC" },
    },
    players: ["A", "B"].map((name, index) =>
      blankSignup(`sp${index}`, {
        playerId: `p${index}`,
        nickname: name,
        fullName: null,
        level: "C",
        category: "ACTIVE",
        aliases: [],
      }),
    ),
    matches: [],
    leaveRequests: [],
    requests: [],
  };
}

function keeper() {
  return new GameDaySync({ state: fixture(), hash: "h0", loadedAt: 1, roster: [] });
}

/** A server that applies what it is sent with the same engine, like /api/gamedays/[id]/sync. */
function fakeServer(start: EngineState, refuse: (op: BoardOp) => string | null = () => null) {
  let state = start;
  return vi.fn(async (_url: string, init: RequestInit) => {
    const { ops } = JSON.parse(String(init.body)) as { ops: BoardOp[] };
    const results = ops.map((op) => {
      const error = refuse(op);
      if (error) return { ok: false, error };
      state = applyOps(state, [op]);
      return { ok: true };
    });
    return new Response(JSON.stringify({ results, state, hash: `h${Math.random()}`, loadedAt: Date.now() }));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GameDaySync", () => {
  it("applies a press at once and clears it when the server confirms", async () => {
    const server = fakeServer(fixture());
    vi.stubGlobal("fetch", server);
    const sync = keeper();
    const result = sync.run({ type: "checkIn", sessionPlayerId: "sp0" });
    expect(result.ok).toBe(true);
    expect(sync.getSnapshot().state.players[0].status).toBe("WAITING");
    expect(sync.getSnapshot().status.pending).toBe(1);

    await vi.waitFor(() => expect(sync.getSnapshot().status.pending).toBe(0));
    expect(server).toHaveBeenCalledTimes(1);
    expect(sync.getSnapshot().state.players[0].status).toBe("WAITING");
    expect(sync.getSnapshot().status.online).toBe(true);
  });

  it("does not send a press the engine refuses", () => {
    const server = fakeServer(fixture());
    vi.stubGlobal("fetch", server);
    const sync = keeper();
    expect(sync.run({ type: "checkIn", sessionPlayerId: "nobody" }).ok).toBe(false);
    expect(sync.getSnapshot().status.pending).toBe(0);
  });

  it("keeps presses on the device while offline and sends them when the signal is back", async () => {
    vi.useFakeTimers();
    let online = false;
    const server = fakeServer(fixture());
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) =>
        online ? server(url, init) : Promise.reject(new TypeError("offline")),
      ),
    );
    const sync = keeper();
    sync.run({ type: "checkIn", sessionPlayerId: "sp0" });
    sync.run({ type: "checkIn", sessionPlayerId: "sp1" });
    await vi.advanceTimersByTimeAsync(0);
    const status: SyncStatus = sync.getSnapshot().status;
    expect(status.online).toBe(false);
    expect(status.pending).toBe(2);
    expect(sync.getSnapshot().state.players.every((row) => row.status === "WAITING")).toBe(true);

    online = true;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(sync.getSnapshot().status.pending).toBe(0);
    expect(server).toHaveBeenCalledTimes(1);
    expect(sync.getSnapshot().state.players.every((row) => row.status === "WAITING")).toBe(true);
  });

  it("reports a press the server refused and shows the server's game day", async () => {
    vi.stubGlobal(
      "fetch",
      fakeServer(fixture(), () => "Changed on another device."),
    );
    const sync = keeper();
    const rejected: string[] = [];
    sync.onRejected(({ error }) => rejected.push(error));
    sync.run({ type: "checkIn", sessionPlayerId: "sp0" });
    await vi.waitFor(() => expect(rejected).toEqual(["Changed on another device."]));
    expect(sync.getSnapshot().state.players[0].status).toBe("EXPECTED");
    expect(sync.getSnapshot().status.pending).toBe(0);
  });

  it("keeps refused changes listed, named by player, until dismissed", async () => {
    vi.stubGlobal(
      "fetch",
      fakeServer(fixture(), (op) => (op.type === "checkIn" ? "Changed on another device." : null)),
    );
    const sync = keeper();
    sync.run({ type: "checkIn", sessionPlayerId: "sp0" });
    await vi.waitFor(() => expect(sync.getSnapshot().status.rejected).toHaveLength(1));
    sync.run({ type: "setPriority", sessionPlayerId: "sp1", priority: true });
    await vi.waitFor(() => expect(sync.getSnapshot().status.pending).toBe(0));

    const [change] = sync.getSnapshot().status.rejected;
    expect(change.label).toBe("Check in · A");
    expect(change.error).toBe("Changed on another device.");
    expect(sync.getSnapshot().status.rejected).toHaveLength(1);

    sync.dismissRejected();
    expect(sync.getSnapshot().status.rejected).toEqual([]);
  });
});

describe("syncLabel", () => {
  const base: SyncStatus = {
    online: true,
    pending: 0,
    sending: false,
    syncedAt: 1,
    problem: null,
    rejected: [],
  };
  it("says saved, saving, offline or signed out", () => {
    expect(syncLabel(base)).toEqual({ text: "Saved · live on all devices", tone: "ok" });
    expect(syncLabel({ ...base, pending: 2 }).text).toBe("Saving 2 changes…");
    expect(syncLabel({ ...base, online: false, pending: 1 }).text).toBe(
      "Offline · 1 change saved on this tablet",
    );
    expect(syncLabel({ ...base, problem: "Signed out." }).tone).toBe("warn");
  });
});
