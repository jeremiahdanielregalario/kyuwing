"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { fail, ok } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { isQueueMaster } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseLevel } from "@/lib/levels";
import { parseCategory, playerSchema, type PlayerInput } from "@/lib/validation";

type ImportSummary = {
  created: number;
  updated: number;
  total: number;
  errors: string[];
};

async function guard() {
  if (!(await isQueueMaster())) return fail("Your queue-master session expired. Sign in again.");
  return null;
}

function normalizeRow(row: Record<string, unknown>) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.toLowerCase().replace(/[\s_-]/g, "")] =
      value === null || value === undefined ? "" : String(value).trim();
  }
  return {
    nickname: normalized.nickname || normalized.name || normalized.nick || "",
    fullName: normalized.fullname || normalized.realname || "",
    level: normalized.level || normalized.skill || "",
    category: normalized.category || normalized.type || normalized.membership || "",
    contact: normalized.contact || normalized.mobile || normalized.phone || "",
    notes: normalized.notes || normalized.note || "",
  };
}

export async function createPlayer(input: PlayerInput): Promise<ActionResult<{ id: string }>> {
  const authError = await guard();
  if (authError) return authError;

  const parsed = playerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the player details.");

  try {
    const player = await prisma.player.create({
      data: {
        nickname: parsed.data.nickname,
        fullName: parsed.data.fullName || null,
        level: parsed.data.level,
        category: parsed.data.category,
        contact: parsed.data.contact || null,
        notes: parsed.data.notes || null,
      },
    });
    revalidatePath("/app/players");
    return ok(`${player.nickname} added.`, { id: player.id });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return fail("That nickname is already in the player database.");
    }
    console.error(error);
    return fail("Could not add the player.");
  }
}

export async function updatePlayer(id: string, input: PlayerInput): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const parsed = playerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the player details.");

  try {
    await prisma.player.update({
      where: { id },
      data: {
        nickname: parsed.data.nickname,
        fullName: parsed.data.fullName || null,
        level: parsed.data.level,
        category: parsed.data.category,
        contact: parsed.data.contact || null,
        notes: parsed.data.notes || null,
      },
    });
    revalidatePath("/app/players");
    return ok("Player updated.");
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return fail("That nickname belongs to another player.");
    }
    console.error(error);
    return fail("Could not update the player.");
  }
}

export async function togglePlayerActive(id: string, active: boolean): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  await prisma.player.update({ where: { id }, data: { active } });
  revalidatePath("/app/players");
  return ok(active ? "Player reactivated." : "Player archived. Their history is kept.");
}

export async function deletePlayer(id: string): Promise<ActionResult> {
  const authError = await guard();
  if (authError) return authError;

  const [matches, sessions] = await Promise.all([
    prisma.matchPlayer.count({ where: { playerId: id } }),
    prisma.sessionPlayer.count({ where: { playerId: id } }),
  ]);

  if (matches > 0 || sessions > 0) {
    await prisma.player.update({ where: { id }, data: { active: false } });
    revalidatePath("/app/players");
    return ok("This player has game history, so they were archived instead of deleted.");
  }

  await prisma.player.delete({ where: { id } });
  revalidatePath("/app/players");
  return ok("Player deleted.");
}

export async function importPlayers(formData: FormData): Promise<ActionResult<ImportSummary>> {
  const authError = await guard();
  if (authError) return authError;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a CSV or JSON file first.");
  if (file.size > 2_000_000) return fail("That file is too large. Keep imports under 2 MB.");

  const text = await file.text();
  let rows: Record<string, unknown>[] = [];

  try {
    if (
      file.name.toLowerCase().endsWith(".json") ||
      text.trim().startsWith("[") ||
      text.trim().startsWith("{")
    ) {
      const json = JSON.parse(text);
      const list = Array.isArray(json) ? json : Array.isArray(json?.players) ? json.players : null;
      if (!list) return fail('JSON should be an array of players, or an object with a "players" array.');
      rows = list;
    } else {
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) => header.trim(),
      });
      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        return fail(`Could not read the CSV: ${parsed.errors[0]?.message ?? "unknown error"}`);
      }
      rows = parsed.data;
    }
  } catch (error) {
    console.error(error);
    return fail("The file could not be parsed. Check that it is valid CSV or JSON.");
  }

  if (rows.length === 0) return fail("The file has no player rows.");
  if (rows.length > 500) return fail("Import at most 500 players per file.");

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const [index, raw] of rows.entries()) {
    const row = normalizeRow(raw);
    if (!row.nickname) {
      errors.push(`Row ${index + 2}: missing nickname`);
      continue;
    }
    const level = parseLevel(row.level);
    if (!level) {
      errors.push(`Row ${index + 2} (${row.nickname}): level "${row.level}" is not recognised`);
      continue;
    }
    const category = parseCategory(row.category);
    if (!category) {
      errors.push(`Row ${index + 2} (${row.nickname}): category should be Active, Inactive, Alumni, or Applicant`);
      continue;
    }

    try {
      const existing = await prisma.player.findUnique({ where: { nickname: row.nickname } });
      await prisma.player.upsert({
        where: { nickname: row.nickname },
        update: {
          fullName: row.fullName || existing?.fullName || null,
          level,
          category,
          contact: row.contact || existing?.contact || null,
          notes: row.notes || existing?.notes || null,
          active: true,
        },
        create: {
          nickname: row.nickname,
          fullName: row.fullName || null,
          level,
          category,
          contact: row.contact || null,
          notes: row.notes || null,
        },
      });
      if (existing) updated += 1;
      else created += 1;
    } catch (error) {
      console.error(error);
      errors.push(`Row ${index + 2} (${row.nickname}): could not save`);
    }
  }

  revalidatePath("/app/players");
  const parts = [];
  if (created) parts.push(`${created} added`);
  if (updated) parts.push(`${updated} updated`);
  if (errors.length) parts.push(`${errors.length} skipped`);
  return ok(parts.length ? parts.join(" · ") : "No players were changed.", {
    created,
    updated,
    total: rows.length,
    errors: errors.slice(0, 8),
  });
}
