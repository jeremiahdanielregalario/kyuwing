import * as React from "react";
import { applyOp, applyOps, type BoardOp, type BoardOpBody, type OpResult } from "@/lib/board-engine/ops";
import type { EngineState, RosterEntry } from "@/lib/board-engine/types";
import { describeOp } from "./describe-op";
import { readGameDay, writeGameDay, type StoredGameDay } from "./idb";

/** What a page hands the board on load: the game day as the server has it right now. */
export type GameDayBootstrap = {
  state: EngineState;
  hash: string;
  loadedAt: number;
  roster: RosterEntry[];
};

export type SyncStatus = {
  /** The last request reached the server. */
  online: boolean;
  /** Presses applied on this device and not confirmed by the server yet. */
  pending: number;
  sending: boolean;
  /** When the server last confirmed the game day (ms), or null before the first contact. */
  syncedAt: number | null;
  /** Set when saving needs the queue master (signed out). */
  problem: string | null;
  /** Changes the device accepted but the server refused, until the queue master dismisses them. */
  rejected: RejectedChange[];
};

export type RejectedChange = { id: string; label: string; error: string; at: number };

export type SyncSnapshot = { state: EngineState; status: SyncStatus };

type Rejection = { op: BoardOp; error: string };

/** The refused-changes list keeps the newest few. */
const MAX_REJECTED = 20;
let askedPersist = false;

/** Asks the browser not to clear this site's storage when space runs low (unsent changes live there). */
function askPersistentStorage() {
  if (askedPersist || typeof navigator === "undefined") return;
  askedPersist = true;
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // Not supported here.
  }
}

const POLL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRY_MS = 15_000;
const BATCH = 50;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function request(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Keeps one game day on this device and in step with the server. Every press is applied here
 * at once with the board engine (so the board works with weak or no signal), saved on the
 * device, and sent in the background; the server applies the same presses and answers with the
 * game day as saved. What the board shows is that saved game day with the unsent presses on top.
 */
export class GameDaySync {
  readonly id: string;
  private base: EngineState;
  private hash: string;
  private loadedAt: number;
  private roster: RosterEntry[];
  private pending: BoardOp[] = [];
  private view: EngineState;
  private status: SyncStatus;
  private snapshot: SyncSnapshot;
  private listeners = new Set<() => void>();
  private rejectionListeners = new Set<(rejection: Rejection) => void>();
  private sending = false;
  private polling = false;
  /** Bumped on every local change, so a poll that started before it is ignored. */
  private version = 0;
  private failures = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private hydrated: Promise<void> | null = null;

  constructor(initial: GameDayBootstrap) {
    this.id = initial.state.gameDay.id;
    this.base = initial.state;
    this.hash = initial.hash;
    this.loadedAt = initial.loadedAt;
    this.roster = initial.roster;
    this.view = this.compute();
    this.status = { online: true, pending: 0, sending: false, syncedAt: null, problem: null, rejected: [] };
    this.snapshot = { state: this.view, status: this.status };
  }

  getSnapshot = (): SyncSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  /** Called when a press the device accepted was refused by the server (e.g. changed elsewhere). */
  onRejected(listener: (rejection: Rejection) => void): () => void {
    this.rejectionListeners.add(listener);
    return () => this.rejectionListeners.delete(listener);
  }

  /** Clears the list of refused changes (the queue master has read it). */
  dismissRejected = () => {
    if (this.status.rejected.length) this.publish({ rejected: [] });
  };

  /** A newer page load: take its game day if it is newer than what this device has. */
  adopt(initial: GameDayBootstrap) {
    if (initial.loadedAt <= this.loadedAt || this.sending) return;
    this.setBase(initial.state, initial.hash, initial.loadedAt);
    this.roster = initial.roster;
    this.refreshView();
  }

  /**
   * Applies a press now and queues it for the server. Returns the engine's answer at once; a
   * refused press changes nothing and is not sent.
   */
  run(body: BoardOpBody): OpResult {
    const op = { id: newId(), at: Date.now(), ...body } as BoardOp;
    const { state, result } = applyOp(this.view, op);
    if (!result.ok) return result;
    this.pending = [...this.pending, op];
    this.version += 1;
    this.view = state;
    if (state.roster) this.roster = state.roster;
    this.publish();
    this.persist();
    queueMicrotask(() => void this.send());
    return result;
  }

  /** Ask the server for the latest now (after a refused press, or the queue master pulls to refresh). */
  refresh() {
    if (this.pending.length) void this.send();
    else void this.poll(true);
  }

  private compute(): EngineState {
    return applyOps({ ...this.base, roster: this.roster }, this.pending);
  }

  private refreshView() {
    this.view = this.compute();
    if (this.view.roster) this.roster = this.view.roster;
    this.publish();
  }

  private setBase(state: EngineState, hash: string, loadedAt: number) {
    this.base = state;
    this.hash = hash;
    this.loadedAt = loadedAt;
  }

  private publish(patch: Partial<SyncStatus> = {}) {
    this.status = {
      ...this.status,
      ...patch,
      pending: this.pending.length,
      sending: this.sending,
    };
    this.snapshot = { state: this.view, status: this.status };
    this.listeners.forEach((listener) => listener());
  }

  private persist() {
    const stored: StoredGameDay = {
      base: this.base,
      hash: this.hash,
      loadedAt: this.loadedAt,
      pending: this.pending,
      roster: this.roster,
    };
    void writeGameDay(this.id, stored);
  }

  private hydrate(): Promise<void> {
    this.hydrated ??= readGameDay(this.id).then((stored) => {
      if (!stored) return;
      const known = new Set(this.pending.map((op) => op.id));
      const unsent = (stored.pending ?? []).filter((op) => !known.has(op.id));
      if (stored.loadedAt > this.loadedAt) {
        this.setBase(stored.base, stored.hash, stored.loadedAt);
        if (stored.roster?.length) this.roster = stored.roster;
      }
      if (unsent.length) this.pending = [...unsent, ...this.pending];
      this.version += 1;
      this.refreshView();
    });
    return this.hydrated;
  }

  private onOnline = () => {
    this.failures = 0;
    void this.send();
    void this.poll(true);
  };

  private onVisible = () => {
    if (document.visibilityState === "visible") this.refresh();
  };

  private start() {
    if (typeof window === "undefined") return;
    askPersistentStorage();
    void this.hydrate().then(() => {
      if (this.pending.length) void this.send();
      else void this.poll(true);
    });
    this.pollTimer = setInterval(() => void this.poll(false), POLL_MS);
    window.addEventListener("online", this.onOnline);
    document.addEventListener("visibilitychange", this.onVisible);
  }

  private stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (typeof window === "undefined") return;
    window.removeEventListener("online", this.onOnline);
    document.removeEventListener("visibilitychange", this.onVisible);
  }

  private retryLater() {
    if (this.retryTimer) return;
    this.failures += 1;
    const wait = Math.min(MAX_RETRY_MS, 1000 * 2 ** Math.min(this.failures, 4));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.send();
    }, wait);
  }

  private async send() {
    if (this.sending || this.pending.length === 0) return;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const batch = this.pending.slice(0, BATCH);
    this.sending = true;
    this.publish();
    let response: Response;
    try {
      response = await request(`/api/gamedays/${this.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: batch }),
      });
    } catch {
      this.sending = false;
      this.publish({ online: false });
      this.retryLater();
      return;
    }
    this.sending = false;
    if (response.status === 401) {
      this.publish({
        online: true,
        problem: "Signed out. Sign in again to save the changes on this tablet.",
      });
      return;
    }
    if (!response.ok) {
      // A server hiccup: try again shortly. The changes stay on this device meanwhile.
      this.publish({ online: response.status !== 503 && response.status !== 504 ? true : false });
      this.retryLater();
      return;
    }
    let body: { results: OpResult[]; state: EngineState; hash: string; loadedAt: number };
    try {
      body = await response.json();
    } catch {
      this.publish();
      this.retryLater();
      return;
    }
    this.failures = 0;
    const sent = new Set(batch.map((op) => op.id));
    const refused: RejectedChange[] = [];
    body.results.forEach((result, index) => {
      const op = batch[index];
      if (!result.ok && op) {
        refused.push({ id: op.id, label: describeOp(op, this.view), error: result.error, at: op.at });
        const rejection = { op, error: result.error };
        this.rejectionListeners.forEach((listener) => listener(rejection));
      }
    });
    this.setBase(body.state, body.hash, body.loadedAt);
    this.pending = this.pending.filter((op) => !sent.has(op.id));
    this.version += 1;
    this.refreshView();
    const rejected = refused.length
      ? [...this.status.rejected, ...refused].slice(-MAX_REJECTED)
      : this.status.rejected;
    this.publish({ online: true, syncedAt: Date.now(), problem: null, rejected });
    this.persist();
    if (this.pending.length) void this.send();
  }

  private async poll(force: boolean) {
    if (this.polling || this.sending || this.pending.length) return;
    if (!force && typeof document !== "undefined" && document.visibilityState !== "visible") return;
    this.polling = true;
    const version = this.version;
    try {
      const response = await request(`/api/gamedays/${this.id}/state`, {
        headers: { "If-None-Match": `"${this.hash}"` },
      });
      if (response.status === 304) {
        this.publish({ online: true, syncedAt: Date.now() });
        return;
      }
      if (response.status === 401) {
        this.publish({ online: true, problem: "Signed out. Sign in again to keep the board in step." });
        return;
      }
      if (!response.ok) return;
      const body: { state: EngineState; hash: string; loadedAt: number } = await response.json();
      // A press made while this was on its way: its own send brings the newest state.
      if (version !== this.version || this.pending.length) return;
      if (body.hash !== this.hash) {
        this.setBase(body.state, body.hash, body.loadedAt);
        this.refreshView();
        this.persist();
      }
      this.publish({ online: true, syncedAt: Date.now(), problem: null });
    } catch {
      this.publish({ online: false });
    } finally {
      this.polling = false;
    }
  }
}

const instances = new Map<string, GameDaySync>();

/** The one keeper for a game day on this device (shared by the board, Fees and Sign-ups). */
function keeperFor(initial: GameDayBootstrap): GameDaySync {
  // On the server every request gets its own; nothing is shared between visitors.
  if (typeof window === "undefined") return new GameDaySync(initial);
  const id = initial.state.gameDay.id;
  const existing = instances.get(id);
  if (existing) return existing;
  const created = new GameDaySync(initial);
  instances.set(id, created);
  return created;
}

/**
 * The game day kept on this device: what to draw, how saving is going, and `run` to make a
 * change. `onRejected` hears about presses the server refused after the device accepted them.
 */
export function useGameDaySync(initial: GameDayBootstrap, onRejected?: (rejection: Rejection) => void) {
  const [keeper] = React.useState(() => keeperFor(initial));
  React.useEffect(() => keeper.adopt(initial), [keeper, initial]);
  const snapshot = React.useSyncExternalStore(keeper.subscribe, keeper.getSnapshot, keeper.getSnapshot);
  const rejectedRef = React.useRef(onRejected);
  React.useEffect(() => {
    rejectedRef.current = onRejected;
  });
  React.useEffect(() => keeper.onRejected((rejection) => rejectedRef.current?.(rejection)), [keeper]);
  const run = React.useCallback((body: BoardOpBody) => keeper.run(body), [keeper]);
  const refresh = React.useCallback(() => keeper.refresh(), [keeper]);
  const current = React.useCallback(() => keeper.getSnapshot().state, [keeper]);
  return {
    state: snapshot.state,
    status: snapshot.status,
    run,
    refresh,
    current,
    dismissRejected: keeper.dismissRejected,
  };
}
