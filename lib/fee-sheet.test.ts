import { describe, expect, it } from "vitest";
import type { TrackerRow } from "./finance-tracker";
import {
  SHEET_COLUMNS,
  clampRange,
  copyValue,
  displayValue,
  inRange,
  rangeLabel,
  rangeOf,
  rangeToHtml,
  rangeToTsv,
} from "./fee-sheet";

function row(overrides: Partial<TrackerRow>): TrackerRow {
  return {
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

  it("labels the range with the Excel sheet's own cell addresses", () => {
    expect(rangeLabel({ top: 0, bottom: 0, left: 2, right: 2 })).toBe("D6");
    expect(rangeLabel({ top: 0, bottom: 2, left: 0, right: 7 })).toBe("B6:I8");
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
