import { PAIRING_WEIGHTS as W } from "./pairing";

/**
 * The pairing engine's scoring, written out as TeX for the playbook. Every number comes from
 * `PAIRING_WEIGHTS`, so the published formula changes when the engine does.
 */

export type FormulaTerm = {
  /** Symbol used in the total, e.g. `B`. */
  symbol: string;
  name: string;
  tex: string;
  /** One plain-language line under the equation. */
  note: string;
};

const n = (value: number) => String(value);

/** Who is next in line: compared left to right, each only breaking a tie in the one before. */
export const LINE_ORDER_TEX = String.raw`\text{line} = \operatorname{sort}\big(\;\pi_p \downarrow,\;\; w_p \downarrow,\;\; t_p \downarrow,\;\; k_p \uparrow\;\big)`;

export const TOTAL_TEX = String.raw`C(\text{match}) = B + S + R + Q + W \qquad \text{lowest } C \text{ goes on court}`;

export const FORMULA_TERMS: FormulaTerm[] = [
  {
    symbol: "B",
    name: "Balance",
    tex: String.raw`B = ${n(W.teamDiff)}\,\big|\,(L_a + L_b) - (L_c + L_d)\,\big|`,
    note: "Team ab against team cd. Every level step between the two team totals costs the same.",
  },
  {
    symbol: "S",
    name: "Teammate spread",
    tex: String.raw`S = \sum_{\text{teammates } i,j} \Big( ${n(W.crossBracket)}\,s\,\max(0,\, g_{ij} - 1) + ${n(W.intraGap)}\,\max(0,\, |L_i - L_j| - ${n(W.intraGapFree)}) \Big)`,
    note: `Partners in the same or the next bracket are free. s is ${n(W.scarcityFactor)} when fewer than ${n(W.scarcityBelow)} are waiting, otherwise 1.`,
  },
  {
    symbol: "R",
    name: "Repeats",
    tex: String.raw`R = \sum_{\text{teammates}} \big(${n(W.repeatTeammate)}\,n_{ij} + ${n(W.recentTeammate)}\,r_{ij}\big) + \sum_{\text{opponents}} \big(${n(W.repeatOpponent)}\,n_{ij} + ${n(W.recentOpponent)}\,r_{ij}\big) + ${n(W.repeatFoursome)}\,n_4 + ${n(W.recentFoursome)}\,r_4`,
    note: `Playing with the same partner, against the same people, or as the same four again. Recent means within the last ${n(W.repeatWindow)} rounds.`,
  },
  {
    symbol: "Q",
    name: "Requests",
    tex: String.raw`Q = -${n(W.honorPair)}\,P^{+} + ${n(W.violatePair)}\,P^{-} - ${n(W.honorAgainst)}\,A^{+} + ${n(W.violateAgainst)}\,A^{-}`,
    note: "Partner (P) and play-against (A) requests between two of the four, kept (+) or broken (−).",
  },
  {
    symbol: "W",
    name: "Waiting",
    tex: String.raw`W = \sum_{p=1}^{4} \Big( ${n(W.games)}\,k_p - ${n(W.wait)}\,\min(w_p,\, ${n(W.waitCap)}) - ${n(W.arrival)}\,\min(t_p,\, ${n(W.arrivalCap)}) - ${n(W.priority)}\,\pi_p \Big)`,
    note: "Waiting longer, arriving earlier and priority lower the cost; games already played raise it a little.",
  },
];

/** What each letter means, in the order members meet them. */
export const FORMULA_LEGEND: Array<{ tex: string; meaning: string }> = [
  { tex: String.raw`L`, meaning: "level as a number, E = 0 up to A+ = 12" },
  { tex: String.raw`g_{ij}`, meaning: "brackets between two partners (E, D, C, B, A)" },
  { tex: String.raw`w_p`, meaning: "minutes waiting since check-in or since their last game ended" },
  { tex: String.raw`t_p`, meaning: "minutes since they checked in" },
  { tex: String.raw`k_p`, meaning: "games played today" },
  { tex: String.raw`\pi_p`, meaning: "1 if the queue master gave them priority, else 0" },
  {
    tex: String.raw`n,\ r`,
    meaning:
      "times these players already played together (or against each other, or as the same four) today; r is 1 if the last time was recent",
  },
];

/** Exchange rates that explain the weights, e.g. one level of imbalance against minutes of waiting. */
export const TRADE_OFFS_TEX: Array<{ tex: string; meaning: string }> = [
  {
    tex: String.raw`\frac{${n(W.teamDiff)}}{${n(W.wait)}} \approx ${Math.round(W.teamDiff / W.wait)}\ \text{min}`,
    meaning: "one level of team imbalance outweighs this much extra waiting",
  },
  {
    tex: String.raw`\frac{${n(W.priority)}}{${n(W.wait)}} \approx ${Math.round(W.priority / W.wait)}\ \text{min}`,
    meaning: "priority is worth about this much waiting",
  },
  {
    tex: String.raw`\frac{${n(W.games)}}{${n(W.wait)}} \approx ${(W.games / W.wait).toFixed(1)}\ \text{min}`,
    meaning: "each game already played counts like this much less waiting",
  },
];
