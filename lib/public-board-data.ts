import { toPublicBoard, type PublicBoard } from "./public-board";
import { getBoardData, getFeeReport } from "./queries";

/** The public board for a game day, with the payment list once it is completed. */
export async function getPublicBoard(gameDayId: string): Promise<PublicBoard | null> {
  const data = await getBoardData(gameDayId);
  if (!data) return null;
  const report = data.gameDay.status === "COMPLETED" ? await getFeeReport(gameDayId) : null;
  return toPublicBoard(data, report?.rows ?? null);
}
