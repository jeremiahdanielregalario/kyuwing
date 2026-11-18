import "server-only";

import { createHash } from "node:crypto";
import { Prisma, type SkillLevel } from "@prisma/client";
import { fail, ok } from "@/lib/action-result";
import { logAttendanceFromGameDay } from "@/lib/attendance-log";
import { prisma } from "@/lib/db";
import { parseCourtPlan } from "@/lib/datetime";
import { canonicalJson, normalizeState } from "@/lib/board-engine/canonical";
import { diffStates, isEmptyChange, type ChangeSet } from "@/lib/board-engine/diff";
import { applyOp, closesGameDay, needsRoster, type BoardOp, type OpResult } from "@/lib/board-engine/ops";
import type { EngineState, RosterEntry } from "@/lib/board-engine/types";

type Tx = Prisma.TransactionClient;

const ms = (date: Date | null) => (date ? date.getTime() : null);
const date = (value: number | null | undefined) =>
  value === null || value === undefined ? null : new Date(value);

/** The club's player list, for walk-ins and sign-ups. */
export async function loadRoster(tx: Tx = prisma): Promise<RosterEntry[]> {
  const rows = await tx.player.findMany({
    select: {
      id: true,
      nickname: true,
      fullName: true,
      level: true,
      category: true,
      aliases: true,
      active: true,
    },
    orderBy: { nickname: "asc" },
  });
  return rows;
}

/** One game day as the engine works on it, or null when it does not exist. */
export async function loadEngineState(
  tx: Tx,
  gameDayId: string,
  options: { roster?: boolean } = {},
): Promise<EngineState | null> {
  const gameDay = await tx.gameDay.findUnique({
    where: { id: gameDayId },
    include: {
      venue: true,
      players: { include: { player: true }, orderBy: { player: { nickname: "asc" } } },
      matches: { include: { players: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      requests: true,
      leaveRequests: { where: { status: "PENDING" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!gameDay) return null;
  const state: EngineState = {
    gameDay: {
      id: gameDay.id,
      name: gameDay.name,
      date: gameDay.date.toISOString(),
      type: gameDay.type,
      status: gameDay.status,
      courtPlan: parseCourtPlan(gameDay.courtPlan),
      notes: gameDay.notes,
      queueMasterName: gameDay.queueMasterName,
      financeMemberName: gameDay.financeMemberName,
      courtRatePerHour: gameDay.courtRatePerHour,
      courtHoursOverride: gameDay.courtHoursOverride,
      flatBaseFee: gameDay.flatBaseFee,
      startedAt: ms(gameDay.startedAt),
      completedAt: ms(gameDay.completedAt),
      venue: { id: gameDay.venue.id, name: gameDay.venue.name, shortName: gameDay.venue.shortName },
    },
    players: gameDay.players.map((row) => ({
      id: row.id,
      playerId: row.playerId,
      nickname: row.player.nickname,
      fullName: row.player.fullName,
      level: row.player.level,
      category: row.player.category,
      aliases: row.player.aliases,
      status: row.status,
      joinedAt: ms(row.joinedAt),
      queuedAt: ms(row.queuedAt),
      lastPlayedAt: ms(row.lastPlayedAt),
      gamesPlayed: row.gamesPlayed,
      permanentPartnerId: row.permanentPartnerId,
      priority: row.priority,
      paid: row.paid,
      amountPaid: row.amountPaid,
      paymentMethod: row.paymentMethod,
      gripCount: row.gripCount,
      otherCharge: row.otherCharge,
      otherNote: row.otherNote,
      voucher: row.voucher,
      settled: row.settled,
      note: row.note,
    })),
    matches: gameDay.matches.map((match) => ({
      id: match.id,
      courtNumber: match.courtNumber,
      round: match.round,
      status: match.status,
      free: match.free,
      rejected: match.rejected,
      note: match.note,
      startedAt: ms(match.startedAt),
      endedAt: ms(match.endedAt),
      createdAt: match.createdAt.getTime(),
      updatedAt: match.updatedAt.getTime(),
      players: match.players
        .map((row) => ({ playerId: row.playerId, team: row.team, slot: row.slot }))
        .sort((a, b) => a.team - b.team || a.slot - b.slot),
    })),
    leaveRequests: gameDay.leaveRequests.map((row) => ({
      id: row.id,
      sessionPlayerId: row.sessionPlayerId,
      status: row.status,
      createdAt: row.createdAt.getTime(),
      resolvedAt: ms(row.resolvedAt),
    })),
    requests: gameDay.requests.map((row) => ({
      id: row.id,
      playerId: row.playerId,
      type: row.type,
      targetPlayerId: row.targetPlayerId,
      active: row.active,
    })),
  };
  if (options.roster) state.roster = await loadRoster(tx);
  return state;
}

/** A short fingerprint of what the database holds for a game day, for "has anything changed?". */
export function stateHash(state: EngineState): string {
  return createHash("sha1")
    .update(canonicalJson(normalizeState(state)))
    .digest("base64url")
    .slice(0, 20);
}

function signupData(
  data: ChangeSet["updatedSignups"][number]["data"],
): Prisma.SessionPlayerUncheckedUpdateInput {
  const out: Prisma.SessionPlayerUncheckedUpdateInput = {};
  for (const [key, value] of Object.entries(data)) {
    (out as Record<string, unknown>)[key] =
      key === "joinedAt" || key === "queuedAt" || key === "lastPlayedAt"
        ? date(value as number | null)
        : value;
  }
  return out;
}

function matchData(data: ChangeSet["updatedMatches"][number]["data"]): Prisma.MatchUncheckedUpdateInput {
  const out: Prisma.MatchUncheckedUpdateInput = {};
  for (const [key, value] of Object.entries(data)) {
    (out as Record<string, unknown>)[key] =
      key === "startedAt" || key === "endedAt" || key === "createdAt" || key === "updatedAt"
        ? date(value as number | null)
        : value;
  }
  return out;
}

/** Writes a change set inside a transaction. */
export async function persistChanges(tx: Tx, gameDayId: string, change: ChangeSet) {
  if (change.gameDay) {
    const { courtPlan, startedAt, completedAt, ...rest } = change.gameDay;
    await tx.gameDay.update({
      where: { id: gameDayId },
      data: {
        ...rest,
        ...(courtPlan !== undefined ? { courtPlan } : {}),
        ...(startedAt !== undefined ? { startedAt: date(startedAt) } : {}),
        ...(completedAt !== undefined ? { completedAt: date(completedAt) } : {}),
      },
    });
  }

  for (const row of change.newPlayers) {
    await tx.player.create({
      data: {
        id: row.playerId,
        nickname: row.nickname,
        level: row.level as SkillLevel,
        category: row.category,
      },
    });
  }
  for (const row of change.levels) {
    await tx.player.update({ where: { id: row.playerId }, data: { level: row.level as SkillLevel } });
  }

  // Leave requests go before sign-ups so a removed sign-up takes nothing with it unexpectedly.
  if (change.deletedLeaves.length)
    await tx.leaveRequest.deleteMany({ where: { id: { in: change.deletedLeaves } } });
  for (const row of change.updatedLeaves) {
    await tx.leaveRequest.update({
      where: { id: row.id },
      data: {
        ...(row.data.status !== undefined ? { status: row.data.status } : {}),
        ...(row.data.resolvedAt !== undefined ? { resolvedAt: date(row.data.resolvedAt) } : {}),
      },
    });
  }

  if (change.deletedSignups.length)
    await tx.sessionPlayer.deleteMany({ where: { id: { in: change.deletedSignups } } });
  if (change.createdSignups.length) {
    await tx.sessionPlayer.createMany({
      data: change.createdSignups.map((row) => ({
        id: row.id,
        gameDayId,
        playerId: row.playerId,
        status: row.status,
        joinedAt: date(row.joinedAt),
        queuedAt: date(row.queuedAt),
        lastPlayedAt: date(row.lastPlayedAt),
        gamesPlayed: row.gamesPlayed,
        permanentPartnerId: row.permanentPartnerId,
        priority: row.priority,
        paid: row.paid,
        amountPaid: row.amountPaid,
        paymentMethod: row.paymentMethod,
        gripCount: row.gripCount,
        otherCharge: row.otherCharge,
        otherNote: row.otherNote,
        voucher: row.voucher,
        settled: row.settled,
        note: row.note,
      })),
    });
  }
  for (const row of change.updatedSignups) {
    await tx.sessionPlayer.update({ where: { id: row.id }, data: signupData(row.data) });
  }

  if (change.deletedMatches.length)
    await tx.match.deleteMany({ where: { id: { in: change.deletedMatches } } });
  for (const match of change.createdMatches) {
    await tx.match.create({
      data: {
        id: match.id,
        gameDayId,
        courtNumber: match.courtNumber,
        round: match.round,
        status: match.status,
        free: match.free,
        rejected: match.rejected,
        note: match.note,
        startedAt: date(match.startedAt),
        endedAt: date(match.endedAt),
        createdAt: new Date(match.createdAt),
        updatedAt: new Date(match.updatedAt),
        players: { create: match.players.map(({ playerId, team, slot }) => ({ playerId, team, slot })) },
      },
    });
  }
  for (const row of change.updatedMatches) {
    if (row.players) await tx.matchPlayer.deleteMany({ where: { matchId: row.id } });
  }
  for (const row of change.updatedMatches) {
    await tx.match.update({
      where: { id: row.id },
      data: {
        ...matchData(row.data),
        ...(row.players
          ? { players: { create: row.players.map(({ playerId, team, slot }) => ({ playerId, team, slot })) } }
          : {}),
      },
    });
  }

  if (change.deletedRequests.length)
    await tx.pairingRequest.deleteMany({ where: { id: { in: change.deletedRequests } } });
  for (const row of change.updatedRequests) {
    await tx.pairingRequest.update({ where: { id: row.id }, data: { active: row.data.active } });
  }
  if (change.createdRequests.length) {
    await tx.pairingRequest.createMany({
      data: change.createdRequests.map((row) => ({
        id: row.id,
        gameDayId,
        playerId: row.playerId,
        type: row.type,
        targetPlayerId: row.targetPlayerId,
        active: row.active,
      })),
    });
  }
}

export type RunOpsResult = {
  results: OpResult[];
  /** The game day after the changes, as the database now holds it; null when it doesn't exist. */
  state: EngineState | null;
  /** The game day was closed by one of these changes (attendance was logged). */
  closed: boolean;
};

const MAX_OPS = 200;

function storedResult(row: { ok: boolean; message: string | null }): OpResult {
  return row.ok ? ok(row.message ?? undefined) : fail(row.message ?? "That change was refused.");
}

/**
 * Applies operations to a game day, in order, with the same engine the tablet runs, and saves
 * the result. The game day row is locked meanwhile, so two senders never interleave. Operations
 * already saved (same id) are not applied again; their stored answer is returned.
 */
export async function runOps(gameDayId: string, ops: BoardOp[]): Promise<RunOpsResult> {
  if (ops.length > MAX_OPS) throw new Error("Too many changes at once.");
  try {
    return await runOpsOnce(gameDayId, ops);
  } catch (error) {
    if (!isPermanent(error)) throw error;
    // Something in the batch can never be saved (e.g. a nickname taken meanwhile). Save the rest
    // one by one and refuse only the change that breaks, so it can't hold up the others forever.
    if (ops.length > 1) {
      const results: OpResult[] = [];
      let state: EngineState | null = null;
      let closed = false;
      for (const op of ops) {
        const one = await runOps(gameDayId, [op]);
        results.push(one.results[0]);
        state = one.state ?? state;
        closed ||= one.closed;
      }
      return { results, state, closed };
    }
    const [op] = ops;
    const message = "That change couldn't be saved. Check the board and try again.";
    await prisma.boardOp
      .create({
        data: {
          id: op.id,
          gameDayId,
          type: String(op.type).slice(0, 40),
          ok: false,
          message,
          pressedAt: new Date(),
        },
      })
      .catch(() => undefined);
    return { results: [fail(message)], state: await loadEngineState(prisma, gameDayId), closed: false };
  }
}

/**
 * A database refusal that will happen again however often the change is sent (a unique or
 * missing-row conflict), as opposed to a dropped connection or a busy database.
 */
function isPermanent(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return !["P1001", "P1002", "P1008", "P1017", "P2024", "P2028", "P2034"].includes(error.code);
}

async function runOpsOnce(gameDayId: string, ops: BoardOp[]): Promise<RunOpsResult> {
  return prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "GameDay" WHERE id = ${gameDayId} FOR UPDATE`;
      if (locked.length === 0)
        return { results: ops.map(() => fail("Game day not found.")), state: null, closed: false };

      const seen = new Map(
        (
          await tx.boardOp.findMany({
            where: { id: { in: ops.map((op) => op.id) } },
            select: { id: true, ok: true, message: true },
          })
        ).map((row) => [row.id, row]),
      );
      const fresh = ops.filter((op) => !seen.has(op.id));
      const before = await loadEngineState(tx, gameDayId, { roster: fresh.some(needsRoster) });
      if (!before) return { results: ops.map(() => fail("Game day not found.")), state: null, closed: false };

      let state = before;
      let closed = false;
      const results: OpResult[] = [];
      const done = new Set<string>();
      const log: Prisma.BoardOpCreateManyInput[] = [];
      for (const op of ops) {
        const stored = seen.get(op.id);
        if (stored) {
          results.push(storedResult(stored));
          continue;
        }
        if (done.has(op.id)) {
          results.push(fail("That change was sent twice."));
          continue;
        }
        done.add(op.id);
        const applied = applyOp(state, op);
        state = applied.state;
        results.push(applied.result);
        if (applied.result.ok && closesGameDay(op)) closed = true;
        log.push({
          id: op.id,
          gameDayId,
          type: String(op.type).slice(0, 40),
          ok: applied.result.ok,
          message:
            (applied.result.ok ? (applied.result.message ?? null) : applied.result.error)?.slice(0, 500) ??
            null,
          pressedAt: new Date(Number.isFinite(op.at) ? op.at : Date.now()),
        });
      }

      const change = diffStates(before, state);
      if (!isEmptyChange(change)) await persistChanges(tx, gameDayId, change);
      if (closed) await logAttendanceFromGameDay(tx, gameDayId);
      if (log.length) await tx.boardOp.createMany({ data: log });

      const saved = { ...state };
      delete saved.roster;
      return { results, state: saved, closed };
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}
