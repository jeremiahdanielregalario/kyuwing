import { prisma } from "./db";
import { checkLeaveRequest } from "./leave-request";

/**
 * Records a player's "I'm leaving" request from the public live link.
 * The queue master is notified by the board polling for pending requests.
 */
export async function createLeaveRequest(
  gameDayId: string,
  nickname: string,
): Promise<{ ok: boolean; message: string }> {
  const name = nickname.trim();
  if (!name) return { ok: false, message: "Type your official nickname first." };

  const gameDay = await prisma.gameDay.findUnique({ where: { id: gameDayId }, select: { status: true } });
  if (!gameDay) return { ok: false, message: "Game day not found." };

  const row = await prisma.sessionPlayer.findFirst({
    where: { gameDayId, player: { nickname: { equals: name, mode: "insensitive" } } },
    include: { player: true, leaveRequests: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  const verdict = checkLeaveRequest({
    gameDayStatus: gameDay.status,
    playerStatus: row?.status ?? null,
    hasPending: row?.leaveRequests.some((request) => request.status === "PENDING") ?? false,
    lastDeclinedAt: row?.leaveRequests.find((request) => request.status === "DECLINED")?.resolvedAt ?? null,
    now: new Date(),
  });
  if (!verdict.allow) return { ok: verdict.ok, message: verdict.message };
  if (!row) return { ok: false, message: "That nickname isn't on today's board." };

  await prisma.leaveRequest.create({ data: { gameDayId, sessionPlayerId: row.id } });
  return {
    ok: true,
    message: `Sent, ${row.player.nickname}! The queue master has been notified and will confirm. Stay put until they do.`,
  };
}
