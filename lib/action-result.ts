export type ActionResult<T = undefined> =
  { ok: true; message?: string; data?: T } | { ok: false; error: string };

export function ok<T = undefined>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, message, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}
