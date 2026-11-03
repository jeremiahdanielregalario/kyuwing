import { describe, expect, it } from "vitest";
import { CATEGORY_KEYS, parseCategory } from "./validation";

describe("parseCategory", () => {
  it("accepts every category key the forms send", () => {
    for (const key of CATEGORY_KEYS) expect(parseCategory(key)).toBe(key);
  });

  it("accepts the spellings people use in imports", () => {
    expect(parseCategory("Non-affiliate")).toBe("NON_AFFILIATE");
    expect(parseCategory("non affiliate")).toBe("NON_AFFILIATE");
    expect(parseCategory("Plus one")).toBe("NON_AFFILIATE");
    expect(parseCategory("guest")).toBe("NON_AFFILIATE");
    expect(parseCategory("Inactive")).toBe("INACTIVE");
    expect(parseCategory("member")).toBe("ACTIVE");
    expect(parseCategory("")).toBe("ACTIVE");
  });

  it("rejects unknown types", () => {
    expect(parseCategory("coach")).toBeNull();
  });
});
