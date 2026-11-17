import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  courtName,
  currentSlotIndex,
  elapsedMinutes,
  formatClock,
  openCourts,
  QUEUED_COURT,
} from "@/lib/datetime";
import { arrangementKey, suggestMatches, type PairingHistoryMatch, type PairingPlayer } from "@/lib/pairing";
import { isFreeBy, planTimeline, playerAvailableAt } from "@/lib/planning";
import {
  createdId,
  hasPlayer,
  isActive,
  newMatch,
  nextRound,
  promoteQueuedGames,
  seedFrom,
  waitingLine,
  type OpContext,
} from "./helpers";
import type { EngineMatch, EngineState } from "./types";

export type GenerateOptions = {
  queue?: boolean;
  /** Suggested games being regenerated: treated as free, avoided, and swapped out for the new ones. */
  replaceMatchIds?: string[];
  seed?: number;
  /** Fill this specific court (an open one) rather than the first free court. */
  courtNumber?: number;
  /**
   * Players the queue master already put on the court (1 to 3), with the side they were put on.
   * They stay on it, keeping partners and opponents, and the engine fills the rest.
   */
  seeds?: Array<{ playerId: string; team: 1 | 2 }>;
};

function teamOf(match: EngineMatch, team: number): string[] {
  return match.players
    .filter((row) => row.team === team)
    .sort((a, b) => a.slot - b.slot)
    .map((row) => row.playerId);
}

/** Auto-pair: builds games for open courts, or the next game in line when every court is taken. */
export function generateMatches(
  state: EngineState,
  ctx: OpContext,
  slotIndex: number | undefined,
  maxMatches: number | undefined,
  options: GenerateOptions = {},
): ActionResult<{ matches: number }> {
  const { gameDay } = state;
  if (gameDay.status === "COMPLETED") return fail("This game day is already closed.");
  const plan = gameDay.courtPlan;
  if (plan.length === 0) return fail("Add at least one court block in Settings first.");
  // Applied already (the same press sent twice): nothing more to do.
  if (state.matches.some((match) => match.id === createdId(ctx, 0)))
    return ok("Pairings ready.", { matches: 0 });
  const index =
    slotIndex !== undefined && slotIndex >= 0 && slotIndex < plan.length
      ? slotIndex
      : currentSlotIndex(plan, new Date(ctx.at));
  const slot = plan[index];
  const nowMs = ctx.at;

  const replacing = state.matches.filter(
    (match) => match.status === "SUGGESTED" && options.replaceMatchIds?.includes(match.id),
  );
  const replacingIds = new Set(replacing.map((match) => match.id));
  if (options.replaceMatchIds && replacing.length === 0)
    return fail("Those suggestions are gone. Press Auto-pair for new ones.");

  const active = state.matches.filter((match) => isActive(match) && !replacingIds.has(match.id));
  const freeCourts = openCourts(
    slot.courts,
    active.map((match) => match.courtNumber),
  );

  // Games already waiting in the Next up line get open courts before anyone new is paired.
  if (
    !replacing.length &&
    !options.queue &&
    !options.seeds?.length &&
    freeCourts.length > 0 &&
    active.some((match) => match.courtNumber === QUEUED_COURT)
  ) {
    const filled = promoteQueuedGames(state, ctx.at);
    if (filled.length > 0)
      return ok(
        `${filled.length === 1 ? "Next up game" : `${filled.length} Next up games`} moved onto ${filled
          .map((court) => courtName(slot, court))
          .join(", ")}. Review and start.`,
        { matches: filled.length },
      );
  }

  // With every court taken (or when the queue master pairs into the waiting court), auto-pair
  // builds the next game and puts it in line.
  const queueing = Boolean(options.queue) || freeCourts.length === 0;

  // A player queued for a suggested or live match is committed to that court; never re-pair them.
  const busyPlayerIds = new Set(active.flatMap((match) => match.players.map((row) => row.playerId)));
  const uncommitted = state.players.filter(
    (row) => row.status === "WAITING" && !busyPlayerIds.has(row.playerId),
  );

  // Planning ahead: when too few players are free, a waiting-court game can also use players who
  // are on court or in an earlier waiting game, as long as they are expected to be done by the
  // time this game would start. Nobody is on two playing courts at once; that is checked at Start.
  const line = waitingLine(state);
  const timeline = planTimeline({
    now: nowMs,
    totalCourts: slot.courts,
    busy: active
      .filter((match) => match.courtNumber !== QUEUED_COURT)
      .map((match) => ({
        courtNumber: match.courtNumber,
        startedAt: match.status === "LIVE" ? (match.startedAt ?? nowMs) : null,
      })),
    queuedGames: line.length,
  });
  // A replaced game keeps its turn; a new one goes to the end of the line.
  const replacedAt = replacing.length === 1 ? line.findIndex((match) => match.id === replacing[0].id) : -1;
  const gameStart = replacedAt >= 0 ? timeline.starts[replacedAt] : timeline.nextStart;

  const widened = queueing && uncommitted.length < 4;
  const waiting = widened
    ? state.players.filter((row) => {
        if (row.status !== "WAITING" && row.status !== "PLAYING") return false;
        const live = active.find((match) => match.status === "LIVE" && hasPlayer(match, row.playerId));
        const plannedStarts = [
          // Assigned to a court but not started: expected to start now.
          ...active
            .filter(
              (match) =>
                match.status === "SUGGESTED" &&
                match.courtNumber !== QUEUED_COURT &&
                hasPlayer(match, row.playerId),
            )
            .map(() => nowMs),
          ...line
            .filter((match) => !replacingIds.has(match.id) && hasPlayer(match, row.playerId))
            .map((match) => timeline.starts[line.indexOf(match)]),
        ];
        return isFreeBy(
          playerAvailableAt({
            now: nowMs,
            liveStartedAt: live ? (live.startedAt ?? nowMs) : null,
            plannedStarts,
          }),
          gameStart,
        );
      })
    : uncommitted;

  if (waiting.length < 4)
    return fail(
      widened
        ? `Not enough players will be free by about ${formatClock(new Date(gameStart))} to plan another game. ${waiting.length} of 4 so far. Check in more players, or plan it later.`
        : "At least four players need to be checked in and waiting.",
    );

  // Players placed by hand: they must be able to play (waiting and free), and stay on the court.
  const seeds = options.seeds ?? [];
  if (seeds.length > 0) {
    if (replacing.length)
      return fail("Regenerate redoes a whole game. Clear the court first to place players by hand.");
    if (new Set(seeds.map((seed) => seed.playerId)).size !== seeds.length)
      return fail("A player can only be placed once.");
    if (seeds.length > 3) return fail("Four players already fill the court. Start it instead.");
    if (
      seeds.filter((seed) => seed.team === 1).length > 2 ||
      seeds.filter((seed) => seed.team === 2).length > 2
    )
      return fail("A team has only two places.");
    const available = new Set(waiting.map((row) => row.playerId));
    const unavailable = seeds.find((seed) => !available.has(seed.playerId));
    if (unavailable) {
      const who = state.players.find((row) => row.playerId === unavailable.playerId)?.nickname ?? "A player";
      return fail(
        `${who} can't be placed right now. They need to be checked in and waiting, and not already in another game.`,
      );
    }
  }
  if (!queueing && options.courtNumber !== undefined && !freeCourts.includes(options.courtNumber))
    return fail(`${courtName(slot, options.courtNumber)} already has a game.`);
  // Real courts to fill: the one asked for, or the free ones in order.
  const targetCourts = !queueing && options.courtNumber !== undefined ? [options.courtNumber] : freeCourts;

  const requestsByPlayer = new Map<string, PairingPlayer["requests"]>();
  for (const request of state.requests) {
    if (!request.active) continue;
    const current = requestsByPlayer.get(request.playerId) ?? [];
    current.push({ type: request.type, targetPlayerId: request.targetPlayerId });
    requestsByPlayer.set(request.playerId, current);
  }

  // Auto-pair is a line: whoever has waited longest (since check-in or their last game) goes
  // first, and earlier arrivals edge ahead, so a late arrival joins the back (see docs/PAIRING.md).
  const now = new Date(nowMs);
  const pairingPlayers: PairingPlayer[] = waiting.map((row) => ({
    id: row.playerId,
    nickname: row.nickname,
    level: row.level as PairingPlayer["level"],
    // Someone still on court has not been waiting, whatever their old queue time says.
    waitMinutes:
      row.status === "WAITING"
        ? elapsedMinutes(
            row.queuedAt !== null
              ? new Date(row.queuedAt)
              : row.joinedAt !== null
                ? new Date(row.joinedAt)
                : null,
            now,
          )
        : 0,
    gamesPlayed: row.gamesPlayed,
    arrivedMinutes: elapsedMinutes(row.joinedAt !== null ? new Date(row.joinedAt) : null, now),
    priority: row.priority,
    permanentPartnerId: row.permanentPartnerId,
    requests: requestsByPlayer.get(row.playerId) ?? [],
  }));

  // Planned and live games count as history too when planning ahead, so the same four are not repeated.
  const history: PairingHistoryMatch[] = state.matches
    .filter(
      (match) =>
        match.status === "COMPLETED" ||
        (widened && !replacingIds.has(match.id) && (match.status === "LIVE" || match.status === "SUGGESTED")),
    )
    .map((match) => ({
      round: match.round,
      playerIds: match.players.map((row) => row.playerId),
      team1: match.players.filter((row) => row.team === 1).map((row) => row.playerId),
      team2: match.players.filter((row) => row.team === 2).map((row) => row.playerId),
    }));

  const round = nextRound(state);
  // Everything rejected so far for these games, plus the ones being replaced now.
  const rejected = [
    ...new Set(
      replacing.flatMap((match) => [...match.rejected, arrangementKey(teamOf(match, 1), teamOf(match, 2))]),
    ),
  ];
  const suggestions = suggestMatches(pairingPlayers, history, {
    courts: queueing ? 1 : Math.max(1, Math.min(targetCourts.length, maxMatches ?? targetCourts.length)),
    round,
    scarcity: waiting.length < 10,
    // Planning ahead: everyone who is free right now plays first; players still on court only fill the gaps.
    // Players placed by hand are always in the game, on the sides they were put.
    mustInclude:
      seeds.length || widened
        ? [
            ...new Set([
              ...(widened ? uncommitted.map((row) => row.playerId) : []),
              ...seeds.map((seed) => seed.playerId),
            ]),
          ]
        : undefined,
    sides: seeds.length ? Object.fromEntries(seeds.map((seed) => [seed.playerId, seed.team])) : undefined,
    variety: replacing.length ? { seed: options.seed ?? seedFrom(ctx.id), avoid: rejected } : undefined,
  });

  const used = new Set<string>();
  const disjoint = suggestions.filter((suggestion) => {
    const ids = suggestion.team1
      .map((player) => player.id)
      .concat(suggestion.team2.map((player) => player.id));
    if (ids.some((id) => used.has(id))) return false;
    ids.forEach((id) => used.add(id));
    return true;
  });
  if (disjoint.length === 0)
    return fail(
      replacing.length
        ? "There is no other fair arrangement with the players waiting. Edit the game by hand, or wait for more players."
        : "The pairing engine could not build a fair match from the current queue.",
    );

  // A replaced waiting game keeps its place in line.
  const keptCreatedAt = queueing && replacing.length === 1 ? replacing[0].createdAt : undefined;
  const inLine = active.filter((match) => match.courtNumber === QUEUED_COURT).length + 1;
  state.matches = state.matches.filter((match) => !replacingIds.has(match.id));
  disjoint.forEach((suggestion, position) => {
    state.matches.push(
      newMatch(
        createdId(ctx, position),
        ctx.at,
        queueing ? QUEUED_COURT : targetCourts[position],
        round,
        suggestion.team1.map((player) => player.id),
        suggestion.team2.map((player) => player.id),
        {
          ...(keptCreatedAt !== undefined ? { createdAt: keptCreatedAt } : {}),
          ...(replacing.length ? { rejected } : {}),
        },
      ),
    );
  });

  if (replacing.length) {
    const where = queueing
      ? "in Next up"
      : `on ${targetCourts
          .slice(0, disjoint.length)
          .map((court) => courtName(slot, court))
          .join(", ")}`;
    return ok(
      `New ${disjoint.length === 1 ? "pairing" : "pairings"} ${where}. Not happy? Regenerate again.`,
      {
        matches: disjoint.length,
      },
    );
  }
  if (queueing)
    return ok(
      options.queue
        ? `Game set in the waiting court as #${inLine}. Transfer it to a court when one is free.`
        : `All courts are busy. Game queued as #${inLine} in Next up. Transfer it to a court when one is free.`,
      { matches: 1 },
    );
  return ok(
    `${disjoint.length} ${disjoint.length === 1 ? "match" : "matches"} suggested on ${targetCourts
      .slice(0, disjoint.length)
      .map((court) => courtName(slot, court))
      .join(", ")}. Review and start.`,
    { matches: suggestions.length },
  );
}

/**
 * "I don't like these pairings": swaps suggested games for different ones. With a `matchId`, only
 * that game is redone (on a court or in Next up); without, every suggestion on the courts is.
 */
export function regenerateMatches(
  state: EngineState,
  ctx: OpContext,
  slotIndex: number | undefined,
  matchId: string | undefined,
): ActionResult<{ matches: number }> {
  const targets = state.matches.filter((match) =>
    matchId
      ? match.id === matchId && match.status === "SUGGESTED"
      : match.status === "SUGGESTED" && match.courtNumber !== QUEUED_COURT,
  );
  if (targets.length === 0)
    return fail("There are no suggested pairings to regenerate. Press Auto-pair first.");
  const queued = targets.length === 1 && targets[0].courtNumber === QUEUED_COURT;
  return generateMatches(state, ctx, slotIndex, targets.length, {
    queue: queued,
    replaceMatchIds: targets.map((match) => match.id),
  });
}
