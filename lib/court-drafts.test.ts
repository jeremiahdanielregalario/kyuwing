import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAFT,
  draftCourt,
  firstFreePlace,
  isWaitingDraft,
  newWaitingDraft,
  placeInDrafts,
  removeFromDrafts,
  waitingDrafts,
} from "./court-drafts";

describe("placeInDrafts", () => {
  it("puts a player in an empty place without touching the input", () => {
    const drafts = {};
    expect(placeInDrafts(drafts, 2, 1, "a")).toEqual({ 2: [null, "a", null, null] });
    expect(drafts).toEqual({});
    expect(EMPTY_DRAFT).toEqual([null, null, null, null]);
  });

  it("moves a player rather than copying them, across courts too", () => {
    const drafts = { 1: ["a", null, null, null], 2: [null, null, null, null] };
    expect(placeInDrafts(drafts, 1, 3, "a")).toEqual({ 1: [null, null, null, "a"], 2: EMPTY_DRAFT });
    expect(placeInDrafts(drafts, 2, 0, "a")).toEqual({ 1: EMPTY_DRAFT, 2: ["a", null, null, null] });
  });

  it("trades places when dragged from one place onto an occupied one", () => {
    const drafts = { 1: ["a", "b", null, null], 2: ["c", null, null, null] };
    expect(placeInDrafts(drafts, 1, 1, "a", { courtNumber: 1, index: 0 })[1]).toEqual(["b", "a", null, null]);
    expect(placeInDrafts(drafts, 2, 0, "a", { courtNumber: 1, index: 0 })).toEqual({
      1: ["c", "b", null, null],
      2: ["a", null, null, null],
    });
  });

  it("replaces the occupant when the player comes from the queue", () => {
    expect(placeInDrafts({ 1: ["a", null, null, null] }, 1, 0, "z")).toEqual({ 1: ["z", null, null, null] });
  });
});

describe("removeFromDrafts", () => {
  it("clears the player everywhere", () => {
    expect(removeFromDrafts({ 0: [null, "a", null, null], 3: ["b", null, null, null] }, "a")).toEqual({
      0: EMPTY_DRAFT,
      3: ["b", null, null, null],
    });
  });
});

describe("firstFreePlace", () => {
  it("takes the first court with room, in the order given", () => {
    const drafts = { 1: ["a", "b", "c", "d"], 2: ["e", null, null, null] };
    expect(firstFreePlace(drafts, [1, 2, 0])).toEqual({ court: 2, index: 1 });
    expect(firstFreePlace(drafts, [3])).toEqual({ court: 3, index: 0 });
    expect(firstFreePlace(drafts, [1])).toBeNull();
    expect(firstFreePlace(drafts, [])).toBeNull();
  });
});

describe("waiting courts filled by hand", () => {
  it("keys waiting courts 0 and below, and sends their games to the waiting line", () => {
    expect(isWaitingDraft(0)).toBe(true);
    expect(isWaitingDraft(-3)).toBe(true);
    expect(isWaitingDraft(1)).toBe(false);
    expect(draftCourt(-2)).toBe(0);
    expect(draftCourt(4)).toBe(4);
  });

  it("starts with one empty waiting court at 0", () => {
    expect(waitingDrafts({})).toEqual([]);
    expect(newWaitingDraft({})).toBe(0);
    expect(newWaitingDraft({ 0: EMPTY_DRAFT, 2: ["a", null, null, null] })).toBe(0);
  });

  it("offers another empty waiting court while others are only part-filled", () => {
    const drafts = { 0: ["a", null, null, null], 3: ["b", null, null, null] };
    expect(waitingDrafts(drafts)).toEqual([0]);
    expect(newWaitingDraft(drafts)).toBe(-1);
    const more = placeInDrafts(drafts, -1, 2, "c");
    expect(waitingDrafts(more)).toEqual([0, -1]);
    expect(newWaitingDraft(more)).toBe(-2);
  });

  it("keeps the order of part-filled waiting courts when an earlier one empties", () => {
    const drafts = { 0: EMPTY_DRAFT, [-1]: ["c", null, null, null] };
    expect(waitingDrafts(drafts)).toEqual([-1]);
    expect(newWaitingDraft(drafts)).toBe(-2);
  });

  it("fills a part-filled waiting court before starting a new one", () => {
    const drafts = { 0: ["a", "b", "c", "d"], [-1]: ["e", null, null, null] };
    expect(firstFreePlace(drafts, [...waitingDrafts(drafts), newWaitingDraft(drafts)])).toEqual({
      court: -1,
      index: 1,
    });
  });
});
