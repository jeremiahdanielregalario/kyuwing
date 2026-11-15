import type { BoardOp } from "@/lib/board-engine/ops";
import type { EngineState, RosterEntry } from "@/lib/board-engine/types";

/**
 * What the tablet keeps for one game day between page loads, so the board opens and works with
 * no signal: the last game day the server confirmed, and the presses not sent yet.
 */
export type StoredGameDay = {
  base: EngineState;
  hash: string;
  /** When `base` came from the server (ms). The newer of this and a fresh page load wins. */
  loadedAt: number;
  pending: BoardOp[];
  roster: RosterEntry[];
};

const DB_NAME = "kyuwing-offline";
const STORE = "gamedays";

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("No IndexedDB"));
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    opening = null;
    throw error;
  });
  return opening;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readGameDay(id: string): Promise<StoredGameDay | undefined> {
  try {
    const db = await open();
    return await done<StoredGameDay | undefined>(db.transaction(STORE).objectStore(STORE).get(id));
  } catch {
    return undefined;
  }
}

let chain: Promise<unknown> = Promise.resolve();

/** Saves in the order asked, so an older copy never lands on top of a newer one. */
export function writeGameDay(id: string, value: StoredGameDay): Promise<void> {
  const next = chain.then(async () => {
    try {
      const db = await open();
      await done(db.transaction(STORE, "readwrite").objectStore(STORE).put(value, id));
    } catch {
      // Private mode or storage full: the board still works, it just won't survive a reload.
    }
  });
  chain = next;
  return next;
}

/** How many changes on this device haven't reached the server yet, across all game days. */
export async function countUnsentChanges(): Promise<number> {
  try {
    const db = await open();
    const all = await done<StoredGameDay[]>(db.transaction(STORE).objectStore(STORE).getAll());
    return all.reduce((sum, day) => sum + (day.pending?.length ?? 0), 0);
  } catch {
    return 0;
  }
}

/**
 * Forgets saved game days on this device, except ones with changes not sent yet (those go up
 * the next time the board opens). Used on the sign-in page.
 */
export async function clearSentGameDays(): Promise<void> {
  try {
    const db = await open();
    const transaction = db.transaction(STORE, "readwrite");
    await new Promise<void>((resolve, reject) => {
      const cursor = transaction.objectStore(STORE).openCursor();
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        if (!(current.value as StoredGameDay).pending?.length) current.delete();
        current.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Nothing saved, or storage unavailable.
  }
}

/**
 * On the sign-in page: forget this device's copies of signed-in pages and of game days already
 * saved on the server. Game days with changes not sent yet are kept, so they still go up.
 */
export async function clearOfflineCopies(): Promise<void> {
  await clearSentGameDays();
  try {
    if (typeof caches !== "undefined") await caches.delete("kyuwing-pages");
  } catch {
    // No cache storage here.
  }
}
