import { describe, expect, it } from "vitest";
import type { FeeRow } from "./board-types";
import { trackerRemarks, trackerRows, trackerSheetName } from "./finance-tracker";

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

  it("lists queue masters on duty first as QM, and carries the voucher", () => {
    const rows = trackerRows([
      row({ nickname: "Wan" }),
      row({ nickname: "Roniel", queueMaster: true, voucher: 100 }),
    ]);
    expect(rows.map((r) => `${r.status} ${r.name} ${r.voucher}`)).toEqual(["QM Roniel 100", "Mem Wan 0"]);
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
