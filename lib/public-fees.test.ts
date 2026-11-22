import { describe, expect, it } from "vitest";
import type { FeeReport, FeeRow } from "./board-types";
import { toPublicFeeSheet } from "./public-fees";
import { feesViewKey, feesViewPath, liveViewKey, verifyFeesViewKey, verifyLiveViewKey } from "./share";

function row(nickname: string, overrides: Partial<FeeRow> = {}): FeeRow {
  return {
    sessionPlayerId: `sp-${nickname}`,
    playerId: `p-${nickname}`,
    nickname,
    fullName: `SANTOS, GIVENSECRET ${nickname}`,
    level: "LEVELSECRET" as FeeRow["level"],
    category: "APPLICANT",
    status: "DONE",
    gamesPlayed: 3,
    flatFee: 100,
    perGameFee: 60,
    surcharge: 10,
    voucher: 0,
    queueMaster: false,
    total: 170,
    gripCount: 0,
    otherCharge: 0,
    otherNote: "SECRET note",
    extras: 0,
    paid: false,
    amountPaid: 0,
    balance: 170,
    change: 0,
    settled: false,
    paymentMethod: null,
    ...overrides,
  };
}

const REPORT: Pick<FeeReport, "gameDay" | "rows" | "summary" | "generatedAt"> = {
  gameDay: {
    id: "gd1",
    name: "Monday Night Lights",
    date: "2026-11-16T00:00:00.000Z",
    type: "REGULAR",
    status: "LIVE",
    notes: "SECRET game day note",
    queueMasterName: "SECRET QM",
    financeMemberName: "SECRET finance",
    courtRatePerHour: 300,
    startedAt: null,
    courtPlan: [],
    venue: { id: "v1", name: "Test Hall", shortName: "TH" },
  },
  rows: [
    row("zed", { paid: true, amountPaid: 200, balance: 0, change: 30, paymentMethod: "GCASH" }),
    row("Ana", { gripCount: 1, extras: 80, total: 250, balance: 250 }),
    row("mia", { amountPaid: 100, balance: 70, paymentMethod: "CASH" }),
  ],
  summary: {
    totalPlayers: 3,
    totalGames: 9,
    totalBilled: 590,
    totalCollected: 300,
    totalOutstanding: 320,
    paidPlayers: 1,
    unpaidPlayers: 2,
  },
  generatedAt: "2026-11-16T12:00:00.000Z",
};

describe("toPublicFeeSheet", () => {
  const sheet = toPublicFeeSheet(REPORT);

  it("lists everyone by nickname, case-insensitively", () => {
    expect(sheet.lines.map((line) => line.nickname)).toEqual(["Ana", "mia", "zed"]);
  });

  it("splits the fee from grips and other charges, and names the payment method", () => {
    const [ana, mia, zed] = sheet.lines;
    expect(ana).toMatchObject({ fee: 170, extras: 80, total: 250, balance: 250, method: null });
    expect(mia).toMatchObject({ amountPaid: 100, balance: 70, paid: false, method: "Cash" });
    expect(zed).toMatchObject({ paid: true, change: 30, method: "GCash" });
  });

  it("carries the totals", () => {
    expect(sheet.summary).toEqual({
      players: 3,
      games: 9,
      billed: 590,
      collected: 300,
      outstanding: 320,
      paidPlayers: 1,
      unpaidPlayers: 2,
    });
    expect(sheet.gameDay).toEqual({
      name: "Monday Night Lights",
      date: "2026-11-16T00:00:00.000Z",
      venue: "Test Hall",
      status: "LIVE",
    });
  });

  it("carries the finance tracker's table: status label, nickname and surname, remarks", () => {
    expect(sheet.sheet.map((row) => row.name)).toEqual(["Ana Santos", "mia Santos", "zed Santos"]);
    expect(sheet.sheet[0]).toEqual({
      verified: false,
      status: "App",
      name: "Ana Santos",
      games: 3,
      total: 250,
      payment: "",
      voucher: 0,
      remarks: "1 grip · Unpaid",
    });
    expect(sheet.sheet[2]).toMatchObject({ verified: true, payment: "GCASH" });
  });

  it("leaves out players who never checked in and paid nothing", () => {
    const sheetOf = (rows: FeeRow[]) => toPublicFeeSheet({ ...REPORT, rows }).sheet.map((r) => r.name);
    expect(sheetOf([row("Ana", { status: "EXPECTED" }), row("Ben")])).toEqual(["Ben Santos"]);
  });

  it("never leaks ids, categories, levels, notes or given names", () => {
    const text = JSON.stringify(sheet);
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("APPLICANT");
    expect(text).not.toContain("GIVENSECRET");
    expect(text).not.toContain("playerId");
    expect(text).not.toContain("sessionPlayerId");
    expect(text).not.toContain("sp-");
    expect(text).not.toContain("p-Ana");
    expect(Object.keys(sheet.lines[0]).sort()).toEqual(
      [
        "amountPaid",
        "balance",
        "change",
        "extras",
        "fee",
        "games",
        "method",
        "nickname",
        "paid",
        "settled",
        "total",
      ].sort(),
    );
    expect(Object.keys(sheet.sheet[0]).sort()).toEqual(
      ["games", "name", "payment", "remarks", "status", "total", "verified", "voucher"].sort(),
    );
  });
});

describe("fees view key", () => {
  it("verifies its own key and builds the path", () => {
    expect(verifyFeesViewKey("gd1", feesViewKey("gd1"))).toBe(true);
    expect(verifyFeesViewKey("gd2", feesViewKey("gd1"))).toBe(false);
    expect(feesViewPath("gd1")).toBe(`/fees/gd1/${feesViewKey("gd1")}`);
  });

  it("is not interchangeable with the live queue key", () => {
    expect(feesViewKey("gd1")).not.toBe(liveViewKey("gd1"));
    expect(verifyFeesViewKey("gd1", liveViewKey("gd1"))).toBe(false);
    expect(verifyLiveViewKey("gd1", feesViewKey("gd1"))).toBe(false);
  });
});
