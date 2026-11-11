"use server";

import { revalidatePath } from "next/cache";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { nameKey } from "@/lib/attendance";
import { isQueueMaster } from "@/lib/auth";
import { parseAwardsText } from "@/lib/awards";
import { dateOnlyFromKey } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { tournamentAwardsSchema } from "@/lib/validation";

async function guard() {
  if (!(await isQueueMaster())) return fail("Your queue-master session expired. Sign in again.");
  return null;
}

/**
 * Saves a tournament's champions and runners-up from pasted text. Saving the same
 * tournament name and date again replaces its awards, so typos can be fixed by re-pasting.
 */
export async function saveTournamentAwards(input: {
  /** Set when editing, so a renamed or re-dated tournament keeps its record. */
  id?: string;
  name: string;
  date: string;
  text: string;
}): Promise<ActionResult<{ tournamentId: string; teams: number }>> {
  const authError = await guard();
  if (authError) return authError;

  const parsedInput = tournamentAwardsSchema.safeParse(input);
  if (!parsedInput.success) return fail(parsedInput.error.issues[0]?.message ?? "Check the form.");
  const { date, text } = parsedInput.data;

  const parsed = parseAwardsText(text);
  if (parsed.errors.length > 0) return fail(parsed.errors[0]);
  const name = parsedInput.data.name || parsed.title;
  if (!name) return fail("Type the tournament name, or put it on the first line of the results.");

  // Podiums use official nicknames, matched without case.
  const players = await prisma.player.findMany({ select: { id: true, nickname: true } });
  const byNick = new Map(players.map((player) => [nameKey(player.nickname), player.id]));
  const unknown = new Set<string>();
  for (const division of parsed.divisions) {
    for (const result of division.results) {
      for (const nick of result.names) if (!byNick.has(nameKey(nick))) unknown.add(nick);
    }
  }
  if (unknown.size > 0) {
    return fail(
      `Not in the player database: ${[...unknown].join(", ")}. Use their official nicknames, or add them first.`,
    );
  }

  const rows = parsed.divisions.flatMap((division, index) =>
    division.results.map((result) => {
      const [first, second] = result.names.map((nick) => byNick.get(nameKey(nick))!);
      return {
        division: division.name,
        place: result.place,
        player1Id: first,
        player2Id: second ?? null,
        position: index,
      };
    }),
  );
  if (rows.some((row) => row.player1Id === row.player2Id)) {
    return fail("A team lists the same player twice.");
  }

  try {
    const day = dateOnlyFromKey(date);
    const sameName = await prisma.tournament.findUnique({
      where: { name_date: { name, date: day } },
      select: { id: true },
    });
    if (input.id && sameName && sameName.id !== input.id) {
      return fail(`${name} on that date already has awards. Edit that one instead.`);
    }
    const existing = input.id ? { id: input.id } : sameName;
    const tournament = await prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.tournament.update({ where: { id: existing.id }, data: { name, date: day } })
        : await tx.tournament.create({ data: { name, date: day } });
      await tx.tournamentAward.deleteMany({ where: { tournamentId: saved.id } });
      await tx.tournamentAward.createMany({
        data: rows.map((row) => ({ ...row, tournamentId: saved.id })),
      });
      return saved;
    });
    revalidatePath("/app/players");
    return ok(
      `${existing ? "Updated" : "Saved"} ${rows.length} podium team${rows.length === 1 ? "" : "s"} for ${name}.`,
      { tournamentId: tournament.id, teams: rows.length },
    );
  } catch (error) {
    console.error(error);
    return fail("Could not save the awards.");
  }
}

export async function deleteTournament(id: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;
  try {
    await prisma.tournament.delete({ where: { id } });
    revalidatePath("/app/players");
    return ok("Tournament awards removed.");
  } catch (error) {
    console.error(error);
    return fail("Could not remove those awards.");
  }
}
