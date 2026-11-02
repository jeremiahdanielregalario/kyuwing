"use server";

import { revalidatePath } from "next/cache";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { isQueueMaster } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { feeRuleSchema, venueUpdateSchema } from "@/lib/validation";

async function guard() {
  if (!(await isQueueMaster())) return fail("Your queue-master session expired. Sign in again.");
  return null;
}

export async function updateVenue(input: unknown): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const parsed = venueUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the venue details.");

  const { id, ...data } = parsed.data;
  try {
    await prisma.venue.update({
      where: { id },
      data: {
        ...data,
        address: data.address || null,
      },
    });
    revalidatePath("/app/venues");
    revalidatePath("/app/gamedays");
    return ok("Venue saved.");
  } catch (error) {
    console.error(error);
    return fail("Could not save the venue. Check that the short name is unique.");
  }
}

export async function saveFeeRules(
  venueId: string,
  rules: Array<{ dayType: string; category: string; flatFee: number; perGameFee: number }>,
): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const parsedRules = rules.map((rule) => feeRuleSchema.safeParse(rule));
  const invalid = parsedRules.find((result) => !result.success);
  if (invalid && !invalid.success) {
    return fail(invalid.error.issues[0]?.message ?? "Check the fee values.");
  }

  await prisma.$transaction(
    parsedRules
      .filter((result): result is Extract<typeof result, { success: true }> => result.success)
      .map((result) =>
        prisma.feeRule.upsert({
          where: {
            venueId_dayType_category: {
              venueId,
              dayType: result.data.dayType,
              category: result.data.category,
            },
          },
          update: {
            flatFee: result.data.flatFee,
            perGameFee: result.data.perGameFee,
          },
          create: {
            venueId,
            dayType: result.data.dayType,
            category: result.data.category,
            flatFee: result.data.flatFee,
            perGameFee: result.data.perGameFee,
          },
        }),
      ),
  );

  revalidatePath("/app/venues");
  return ok("Fee table saved.");
}
