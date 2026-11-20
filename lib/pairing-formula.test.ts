import katex from "katex";
import { describe, expect, it } from "vitest";
import { PAIRING_WEIGHTS } from "./pairing";
import { FORMULA_LEGEND, FORMULA_TERMS, LINE_ORDER_TEX, TOTAL_TEX, TRADE_OFFS_TEX } from "./pairing-formula";

const all = [
  LINE_ORDER_TEX,
  TOTAL_TEX,
  ...FORMULA_TERMS.map((term) => term.tex),
  ...FORMULA_LEGEND.map((item) => item.tex),
  ...TRADE_OFFS_TEX.map((item) => item.tex),
];

describe("published pairing formula", () => {
  it("renders every piece with KaTeX", () => {
    for (const tex of all) {
      expect(() => katex.renderToString(tex, { throwOnError: true })).not.toThrow();
    }
  });

  it("uses the engine's own weights", () => {
    const text = FORMULA_TERMS.map((term) => term.tex).join(" ");
    for (const key of [
      "teamDiff",
      "crossBracket",
      "intraGap",
      "repeatTeammate",
      "recentTeammate",
      "repeatOpponent",
      "recentOpponent",
      "repeatFoursome",
      "recentFoursome",
      "wait",
      "waitCap",
      "arrival",
      "arrivalCap",
      "games",
      "priority",
      "honorPair",
      "honorAgainst",
      "violatePair",
      "violateAgainst",
    ] as const) {
      expect(text).toContain(String(PAIRING_WEIGHTS[key]));
    }
  });

  it("names every term in the total", () => {
    for (const term of FORMULA_TERMS) expect(TOTAL_TEX).toContain(term.symbol);
  });
});
