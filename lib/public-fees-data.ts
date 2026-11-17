import { toPublicFeeSheet, type PublicFeeSheet } from "./public-fees";
import { getFeeReport } from "./queries";

/** The finance member's view-only fees sheet for a game day. */
export async function getPublicFeeSheet(gameDayId: string): Promise<PublicFeeSheet | null> {
  const report = await getFeeReport(gameDayId);
  return report ? toPublicFeeSheet(report) : null;
}
