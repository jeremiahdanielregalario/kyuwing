"use server";

import { revalidatePath } from "next/cache";
import { isQueueMaster } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/db";
import { checkSignup, notReadyReason, type SignupCheck, type SignupTexts } from "@/lib/signup-check";

const MAX_TEXT = 20000;

/** Both pasted lists, or null when either is not text or is too long. */
function validTexts(texts: SignupTexts): SignupTexts | null {
  if (!texts || typeof texts !== "object") return null;
  const { members, applicants } = texts;
  if (typeof members !== "string" || typeof applicants !== "string") return null;
  if (members.length > MAX_TEXT || applicants.length > MAX_TEXT) return null;
  return { members, applicants };
}

/** Reads the pasted Messenger lists and reports what is wrong with them. Changes nothing. */
export async function checkSignupText(
  texts: SignupTexts,
  gameDayId?: string,
): Promise<ActionResult<SignupCheck>> {
  if (!(await isQueueMaster())) return fail("Your queue-master session expired. Sign in again.");
  const valid = validTexts(texts);
  if (!valid) return fail("That list is too long to read.");
  return ok(undefined, await checkSignup(valid, gameDayId));
}

/**
 * Adds everyone on the pasted lists (members and applicants) to an existing game day, for when players keep
 * updating the chat before the day. Nothing is added unless every name is an
 * official nickname, and nobody is removed or duplicated.
 */
export async function addPlayersFromText(
  gameDayId: string,
  texts: SignupTexts,
): Promise<ActionResult<{ added: number; already: number }>> {
  if (!(await isQueueMaster())) return fail("Your queue-master session expired. Sign in again.");
  const valid = validTexts(texts);
  if (!valid) return fail("That list is too long to read.");

  const gameDay = await prisma.gameDay.findUnique({ where: { id: gameDayId }, select: { id: true } });
  if (!gameDay) return fail("Game day not found.");

  const check = await checkSignup(valid, gameDayId);
  if (!check.ready) return fail(notReadyReason(check));

  const nicknames = [...new Set(check.lines.filter((line) => !line.waitlist).map((line) => line.nickname!))];
  const players = await prisma.player.findMany({
    where: { nickname: { in: nicknames } },
    select: { id: true, nickname: true },
  });
  const existing = await prisma.sessionPlayer.findMany({ where: { gameDayId }, select: { playerId: true } });
  const have = new Set(existing.map((row) => row.playerId));
  const toAdd = players.filter((player) => !have.has(player.id));

  if (toAdd.length > 0) {
    await prisma.sessionPlayer.createMany({
      data: toAdd.map((player) => ({ gameDayId, playerId: player.id, status: "EXPECTED" as const })),
      skipDuplicates: true,
    });
  }

  revalidatePath(`/app/gamedays/${gameDayId}`);
  revalidatePath(`/app/gamedays/${gameDayId}/signups`);
  const already = players.length - toAdd.length;
  return ok(
    toAdd.length === 0
      ? "Everyone on that list is already signed up."
      : `${toAdd.length} ${toAdd.length === 1 ? "player" : "players"} added${already ? `, ${already} already on the list` : ""}.`,
    { added: toAdd.length, already },
  );
}
