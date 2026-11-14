/**
 * Short sound cues for the queue master: a game starting or finishing, a saved change, an
 * error, a player placed on a court, and things that need attention (a leave request, a game
 * that has not started). The clips are CC0 (see `public/sounds/LICENSE.txt`), about 6 KB each,
 * fetched once on the first touch and played through Web Audio so they never block a press.
 *
 * Sound is on by default and can be switched off per device (`setSoundOn`).
 */
export type SoundKind = "success" | "error" | "start" | "finish" | "alert" | "drop";

const STORAGE_KEY = "kyuwing:sound";
const VOLUME: Record<SoundKind, number> = {
  success: 0.45,
  error: 0.5,
  start: 0.55,
  finish: 0.55,
  alert: 0.7,
  drop: 0.4,
};

/** A specific cue (start, finish, drop) already said "it worked"; the generic one that follows is noise. */
const SPECIFIC: ReadonlySet<SoundKind> = new Set<SoundKind>(["start", "finish", "drop"]);
const FOLLOW_UP_MS = 2500;
const REPEAT_MS = 120;

/**
 * Whether a cue should stay silent given the one before it: the generic "success" right after
 * a specific cue, and the same cue fired twice in the same instant.
 */
export function shouldSkipSound(
  kind: SoundKind,
  last: { kind: SoundKind; at: number } | null,
  now: number,
): boolean {
  if (!last) return false;
  const gap = now - last.at;
  if (gap < 0) return false;
  if (kind === last.kind && gap < REPEAT_MS) return true;
  return kind === "success" && SPECIFIC.has(last.kind) && gap < FOLLOW_UP_MS;
}

let context: AudioContext | null = null;
const buffers = new Map<SoundKind, AudioBuffer>();
const loading = new Map<SoundKind, Promise<AudioBuffer | null>>();
let last: { kind: SoundKind; at: number } | null = null;
let primed = false;
let on: boolean | null = null;
const listeners = new Set<() => void>();

function readOn(): boolean {
  if (on !== null) return on;
  try {
    on = window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    on = true;
  }
  return on;
}

export function isSoundOn(): boolean {
  return typeof window === "undefined" ? true : readOn();
}

export function setSoundOn(next: boolean) {
  on = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    // Private mode: the choice lasts until the page reloads.
  }
  listeners.forEach((listener) => listener());
  if (next) {
    unlock();
    playSound("success");
  }
}

export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

function load(kind: SoundKind): Promise<AudioBuffer | null> {
  const ready = buffers.get(kind);
  if (ready) return Promise.resolve(ready);
  const pending = loading.get(kind);
  if (pending) return pending;
  const ctx = getContext();
  if (!ctx) return Promise.resolve(null);
  const request = fetch(`/sounds/${kind}.m4a`)
    .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error("missing"))))
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((buffer) => {
      buffers.set(kind, buffer);
      return buffer;
    })
    .catch(() => {
      loading.delete(kind);
      return null;
    });
  loading.set(kind, request);
  return request;
}

/** Browsers only allow audio after a touch: wake the audio context and fetch the clips then. */
function unlock() {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  (Object.keys(VOLUME) as SoundKind[]).forEach((kind) => void load(kind));
}

/** Call once from a mounted client component; the first touch or key press readies the sounds. */
export function primeSounds() {
  if (primed || typeof window === "undefined") return;
  primed = true;
  const wake = () => {
    if (!readOn()) return;
    unlock();
    window.removeEventListener("pointerdown", wake);
    window.removeEventListener("keydown", wake);
  };
  window.addEventListener("pointerdown", wake, { passive: true });
  window.addEventListener("keydown", wake, { passive: true });
}

export function playSound(kind: SoundKind) {
  // Only where the sound switch is on screen (the queue master's app), never on public pages.
  if (typeof window === "undefined" || !primed || !readOn()) return;
  const now = Date.now();
  if (shouldSkipSound(kind, last, now)) return;
  last = { kind, at: now };
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;
  void load(kind).then((buffer) => {
    // A clip that took too long to arrive would play out of step with what happened.
    if (!buffer || Date.now() - now > 600) return;
    try {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = VOLUME[kind];
      source.buffer = buffer;
      source.connect(gain).connect(ctx.destination);
      source.start();
    } catch {
      // Audio is a nicety; never let it break a press.
    }
  });
}
