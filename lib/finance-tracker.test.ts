import { describe, expect, it } from "vitest";
import type { FeeReport, FeeRow } from "./board-types";
import {
  TRACKER_PAYMENT,
  financeSummary,
  trackerRemarks,
  trackerRows,
  trackerSheetName,
} from "./finance-tracker";
import { PAYMENT_METHOD_LABELS } from "./fees";
import { PAYMENT_METHOD_KEYS } from "./validation";

function row(overrides: Partial<FeeRow>): FeeRow {
  return {
    sessionPlayerId: "s",
    playerId: "p",
    nickname: "Jess",
    level: "C",
    category: "ACTIVE",
    status: "DONE",
    gamesPlayed: 5,
    flatFee: 120,
    perGameFee: 20,
    surcharge: 0,
    voucher: 0,
    queueMaster: false,
    total: 220,
    gripCount: 0,
    otherCharge: 0,
    otherNote: null,
    extras: 0,
    paid: true,
    amountPaid: 220,
    balance: 0,
    change: 0,
    settled: true,
    paymentMethod: "GCASH",
    ...overrides,
  };
}

describe("trackerRows", () => {
  it("maps a fee row to the template's columns", () => {
    expect(trackerRows([row({})])).toEqual([
      {
        sessionPlayerId: "s",
        verified: true,
        status: "Mem",
        name: "Jess",
        games: 5,
        total: 220,
        payment: "GCASH",
        voucher: 0,
        remarks: "",
      },
    ]);
  });

  it("uses the template's status labels and order, and leaves out no-shows", () => {
    const rows = trackerRows([
      row({ nickname: "Wan", category: "ACTIVE" }),
      row({ nickname: "Ian", category: "NON_AFFILIATE" }),
      row({ nickname: "Harry", category: "ALUMNI" }),
      row({ nickname: "Asher", category: "APPLICANT" }),
      row({ nickname: "Carl", category: "INACTIVE" }),
      row({ nickname: "Gone", status: "EXPECTED", amountPaid: 0 }),
    ]);
    expect(rows.map((r) => `${r.status} ${r.name}`)).toEqual([
      "App Asher",
      "Inact/Alum Carl",
      "Inact/Alum Harry",
      "Mem Wan",
      "Plus 1 Ian",
    ]);
  });

  it("gives queue masters on duty their own membership status, and carries the voucher", () => {
    const rows = trackerRows([
      row({ nickname: "Wan" }),
      row({ nickname: "Roniel", queueMaster: true, voucher: 100 }),
      row({ nickname: "Jgops", queueMaster: true, category: "ALUMNI" }),
    ]);
    expect(rows.map((r) => `${r.status} ${r.name} ${r.voucher}`)).toEqual([
      "Inact/Alum Jgops 0",
      "Mem Roniel 100",
      "Mem Wan 0",
    ]);
  });

  it("leaves the payment blank for someone who has not paid", () => {
    const [unpaid] = trackerRows([row({ paid: false, amountPaid: 0, balance: 220, paymentMethod: null })]);
    expect(unpaid.verified).toBe(false);
    expect(unpaid.payment).toBe("");
    expect(unpaid.remarks).toBe("Unpaid");
  });
});

describe("trackerRemarks", () => {
  it("notes grips, other charges, change and balances", () => {
    expect(trackerRemarks(row({ gripCount: 2, otherCharge: 50, otherNote: "Towel" }))).toBe(
      "2 grips · Towel ₱50",
    );
    expect(trackerRemarks(row({ change: 35, settled: true }))).toBe("Sukli ₱35");
    expect(trackerRemarks(row({ change: 35, settled: false }))).toBe("Sukli ₱35 (not yet given)");
    expect(trackerRemarks(row({ amountPaid: 100, balance: 120, paid: false }))).toBe("Balance ₱120");
  });
});

describe("trackerSheetName", () => {
  it("names the sheet after the game date like the template", () => {
    expect(trackerSheetName("2026-11-18T00:00:00.000Z")).toBe("November 18, 2026");
  });
});

describe("payment methods", () => {
  it("knows Maya and GoTyme everywhere a method is listed", () => {
    for (const method of PAYMENT_METHOD_KEYS) {
      expect(PAYMENT_METHOD_LABELS[method]).toBeTruthy();
      expect(TRACKER_PAYMENT[method]).toBe(method);
    }
    expect(PAYMENT_METHOD_LABELS.MAYA).toBe("Maya");
    expect(PAYMENT_METHOD_LABELS.GOTYME).toBe("GoTyme");
  });
});

describe("financeSummary", () => {
  function report(rows: FeeRow[], totalGames: number): FeeReport {
    return {
      rows,
      summary: { totalGames },
      scheme: { split: { flatFee: 120, courtCost: 1200 } },
    } as unknown as FeeReport;
  }

  it("works out expenses, revenue and totals by method like the Excel side panel", () => {
    const summary = financeSummary(
      report(
        [
          row({ nickname: "A", total: 220, paymentMethod: "CASH" }),
          row({ nickname: "B", total: 200, paymentMethod: "GCASH" }),
          row({ nickname: "C", total: 180, paymentMethod: "GCASH", category: "APPLICANT" }),
          row({
            nickname: "D",
            total: 150,
            paymentMethod: null,
            paid: false,
            amountPaid: 0,
            category: "NON_AFFILIATE",
          }),
          row({ nickname: "E", total: 0, category: "ALUMNI", paymentMethod: "CASH" }),
          row({ nickname: "F", status: "EXPECTED", paid: false, amountPaid: 0, paymentMethod: null }),
        ],
        24,
      ),
      880,
    );
    expect(summary.basePrice).toBe(120);
    expect(summary.rent).toBe(1200);
    expect(summary.shuttlesUsed).toBe(6);
    expect(summary.totalExpenses).toBe(880 / 2 + 1200);
    expect(summary.byMethod).toEqual([
      { method: "CASH", amount: 220 },
      { method: "GCASH", amount: 380 },
      { method: "MAYA", amount: 0 },
      { method: "GOTYME", amount: 0 },
    ]);
    expect(summary.totalByMethod).toBe(600);
    expect(summary.estimatedRevenue).toBe(600 - 1640);
    expect(summary.counts).toEqual({ members: 2, inactiveAlumni: 1, applicants: 1, plusOnes: 1 });
  });

  it("counts queue masters on duty under their own membership status", () => {
    const summary = financeSummary(
      report([row({ nickname: "Roniel", queueMaster: true }), row({ nickname: "Wan" })], 4),
      880,
    );
    expect(summary.counts).toEqual({ members: 2, inactiveAlumni: 0, applicants: 0, plusOnes: 0 });
  });

  it("lists Bank and Other only when something came in that way", () => {
    const summary = financeSummary(report([row({ total: 300, paymentMethod: "OTHER" })], 4), 880);
    expect(summary.byMethod.map((entry) => entry.method)).toEqual([
      "CASH",
      "GCASH",
      "MAYA",
      "GOTYME",
      "OTHER",
    ]);
    expect(summary.totalByMethod).toBe(300);
  });
});
