"use server";

import { revalidatePath } from "next/cache";
import { isQueueMaster } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/db";
import { checkSignup, notReadyReason, type SignupCheck } from "@/lib/signup-check";

const MAX_TEXT = 20000;

/** Reads a pasted Messenger list and reports what is wrong with it. Changes nothing. */
export async function checkSignupText(text: string, gameDayId?: string): Promise<ActionResult<SignupCheck>> {
  if (!(await isQueueMaster())) return fail("Your queue-master session expired. Sign in again.");
  if (typeof text !== "string" || text.length > MAX_TEXT) return fail("That list is too long to read.");
  return ok(undefined, await checkSignup(text, gameDayId));
}

/**
 * Adds everyone on a pasted list to an existing game day, for when players keep
 * updating the chat before the day. Nothing is added unless every name is an
 * official nickname, and nobody is removed or duplicated.
 */
export async function addPlayersFromText(
  gameDayId: string,
  text: string,
): Promise<ActionResult<{ added: number; already: number }>> {
  if (!(await isQueueMaster())) return fail("Your queue-master session expired. Sign in again.");
  if (typeof text !== "string" || text.length > MAX_TEXT) return fail("That list is too long to read.");

  const gameDay = await prisma.gameDay.findUnique({ where: { id: gameDayId }, select: { id: true } });
  if (!gameDay) return fail("Game day not found.");

  const check = await checkSignup(text, gameDayId);
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
