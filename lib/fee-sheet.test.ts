import { describe, expect, it } from "vitest";
import type { FeeRow } from "./board-types";
import type { TrackerRow } from "./finance-tracker";
import {
  SHEET_COLUMNS,
  clampRange,
  copyValue,
  displayValue,
  edgeScroll,
  handleAnchor,
  inRange,
  parseCellKey,
  parseAmount,
  paymentForEdit,
  rangeOf,
  rangeToHtml,
  rangeToTsv,
} from "./fee-sheet";

function row(overrides: Partial<TrackerRow>): TrackerRow {
  return {
    sessionPlayerId: "s",
    verified: true,
    status: "Mem",
    name: "Jess",
    games: 5,
    total: 1220,
    payment: "GCASH",
    voucher: 0,
    remarks: "",
    ...overrides,
  };
}

const rows = [
  row({}),
  row({ verified: false, status: "App", name: "Kai", games: 3, total: 185, payment: "", remarks: "Unpaid" }),
  row({ name: "Lu <b>", remarks: "1 grip\tSukli ₱35", voucher: 100 }),
];
const col = (key: string) => SHEET_COLUMNS.find((column) => column.key === key)!;

describe("fee sheet cells", () => {
  it("uses the Excel report's columns, in order", () => {
    expect(SHEET_COLUMNS.map((column) => column.label)).toEqual([
      "VERIFIED?",
      "Membership Status",
      "Name",
      "No. of Games",
      "Total Amount",
      "Mode of Payment",
      "Voucher",
      "Remarks",
    ]);
  });

  it("shows amounts like the sheet and copies them as plain numbers", () => {
    expect(displayValue(rows[0], col("total"))).toBe("₱1,220.00");
    expect(copyValue(rows[0], col("total"))).toBe("1220");
    expect(displayValue(rows[0], col("verified"))).toBe("✓");
    expect(copyValue(rows[1], col("verified"))).toBe("FALSE");
  });
});

describe("fee sheet selection", () => {
  it("builds a range from corners in either order", () => {
    expect(rangeOf({ row: 2, col: 4 }, { row: 0, col: 1 })).toEqual({ top: 0, bottom: 2, left: 1, right: 4 });
    const range = rangeOf({ row: 0, col: 1 }, { row: 1, col: 2 });
    expect(inRange(range, 1, 2)).toBe(true);
    expect(inRange(range, 2, 2)).toBe(false);
    expect(inRange(null, 0, 0)).toBe(false);
  });

  it("shrinks a range when rows go away, and drops it when nothing is left", () => {
    expect(clampRange({ top: 1, bottom: 5, left: 0, right: 9 }, 3, 8)).toEqual({
      top: 1,
      bottom: 2,
      left: 0,
      right: 7,
    });
    expect(clampRange({ top: 4, bottom: 5, left: 0, right: 1 }, 3, 8)).toBeNull();
  });
});

describe("fee sheet copy", () => {
  it("copies a block as tab-separated rows that paste into cells", () => {
    expect(rangeToTsv(rows, { top: 0, bottom: 1, left: 2, right: 4 })).toBe("Jess\t5\t1220\nKai\t3\t185");
  });

  it("can include the headings", () => {
    expect(rangeToTsv(rows, { top: 1, bottom: 1, left: 2, right: 3 }, true)).toBe(
      "Name\tNo. of Games\nKai\t3",
    );
  });

  it("keeps a cell's tabs and line breaks from splitting it across cells", () => {
    expect(rangeToTsv(rows, { top: 2, bottom: 2, left: 7, right: 7 })).toBe("1 grip Sukli ₱35");
  });

  it("copies an HTML table with the text escaped", () => {
    expect(rangeToHtml(rows, { top: 2, bottom: 2, left: 2, right: 2 }, true)).toBe(
      "<table><tr><th>Name</th></tr><tr><td>Lu &lt;b&gt;</td></tr></table>",
    );
  });
});

function fee(overrides: Partial<FeeRow>): FeeRow {
  return {
    sessionPlayerId: "s",
    playerId: "p",
    nickname: "Jess",
    fullName: null,
    level: "C",
    category: "ACTIVE",
    status: "DONE",
    gamesPlayed: 5,
    flatFee: 120,
    perGameFee: 20,
    surcharge: 0,
    voucher: 0,
    queueMaster: false,
    total: 260,
    gripCount: 1,
    otherCharge: 0,
    otherNote: null,
    extras: 40,
    paid: false,
    amountPaid: 0,
    balance: 260,
    change: 0,
    settled: false,
    paymentMethod: null,
    ...overrides,
  };
}

describe("fee sheet edits", () => {
  it("ticking VERIFIED? records a full payment, unticking clears it", () => {
    expect(paymentForEdit(fee({}), { verified: true })).toEqual({ paid: true, method: "CASH" });
    expect(
      paymentForEdit(fee({ paid: true, amountPaid: 260, paymentMethod: "GCASH" }), { verified: true }),
    ).toEqual({
      paid: true,
      method: "GCASH",
    });
    expect(paymentForEdit(fee({ paid: true, amountPaid: 260 }), { verified: false })).toEqual({
      paid: false,
      amountPaid: 0,
    });
  });

  it("picking a mode of payment marks the player paid, and keeps an amount already paid", () => {
    expect(paymentForEdit(fee({}), { method: "MAYA" })).toEqual({ paid: true, method: "MAYA" });
    expect(
      paymentForEdit(fee({ paid: true, amountPaid: 300, paymentMethod: "CASH" }), { method: "GCASH" }),
    ).toEqual({ paid: true, amountPaid: 300, method: "GCASH" });
    expect(paymentForEdit(fee({ paid: true, amountPaid: 260 }), { method: null })).toEqual({
      paid: false,
      amountPaid: 0,
    });
  });

  it("a voucher keeps an exact payment exact and leaves the other charges alone", () => {
    const exact = paymentForEdit(fee({ paid: true, amountPaid: 260, paymentMethod: "GCASH" }), {
      voucher: 100,
    });
    expect(exact).toEqual({
      paid: true,
      method: "GCASH",
      charges: { gripCount: 1, otherCharge: 0, otherNote: null, voucher: 100 },
    });
    const partial = paymentForEdit(fee({ amountPaid: 100 }), { voucher: 50 });
    expect(partial).toMatchObject({ paid: false, amountPaid: 100, method: null });
  });

  it("reads a typed amount", () => {
    expect(parseAmount("₱1,500")).toBe(1500);
    expect(parseAmount(" ")).toBe(0);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
  });
});

describe("touch selection helpers", () => {
  it("reads a cell from its data-cell key", () => {
    expect(parseCellKey("3-5")).toEqual({ row: 3, col: 5 });
    expect(parseCellKey("x")).toBeNull();
    expect(parseCellKey(null)).toBeNull();
  });

  it("stretches a selection from the corner opposite the handle", () => {
    const range = { top: 1, left: 2, bottom: 4, right: 6 };
    expect(handleAnchor(range, "end")).toEqual({ row: 1, col: 2 });
    expect(handleAnchor(range, "start")).toEqual({ row: 4, col: 6 });
  });

  it("scrolls only near the grid's edges, faster closer to them", () => {
    const box = { left: 0, top: 0, right: 400, bottom: 600 };
    expect(edgeScroll({ x: 200, y: 300 }, box)).toEqual({ dx: 0, dy: 0 });
    expect(edgeScroll({ x: 200, y: 590 }, box).dy).toBeGreaterThan(0);
    expect(edgeScroll({ x: 200, y: 10 }, box).dy).toBeLessThan(0);
    expect(edgeScroll({ x: 395, y: 300 }, box).dx).toBeGreaterThan(edgeScroll({ x: 370, y: 300 }, box).dx);
    expect(edgeScroll({ x: -50, y: 300 }, box).dx).toBe(-16);
  });
});
