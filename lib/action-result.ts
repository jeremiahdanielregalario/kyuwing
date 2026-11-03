/** Why a failure happened, when the caller wants to react to it rather than just show it. */
export type ActionFailureCode = "PLAYER_STILL_PLAYING";

export type ActionResult<T = undefined> =
  { ok: true; message?: string; data?: T } | { ok: false; error: string; code?: ActionFailureCode };

export function ok<T = undefined>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, message, data };
}

export function fail(error: string, code?: ActionFailureCode): ActionResult<never> {
  return code ? { ok: false, error, code } : { ok: false, error };
}
