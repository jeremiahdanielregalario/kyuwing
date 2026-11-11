import { describe, expect, it } from "vitest";
import { liveQrFileName, liveShareMessage } from "@/lib/share-message";

const gameDay = { name: "Monday Night Lights", date: "2026-11-11T00:00:00.000Z", venue: "KBC" };

describe("liveShareMessage", () => {
  it("names the game day, the date and venue, and puts the link on its own line", () => {
    const message = liveShareMessage(gameDay, "https://example.com/live/abc/key");
    const lines = message.split("\n");
    expect(lines[0]).toBe("🏸 Live queue: Monday Night Lights");
    expect(lines[1]).toBe("Wednesday, Nov 11 · KBC");
    expect(lines).toContain("https://example.com/live/abc/key");
  });

  it("uses the Manila calendar date stored as UTC midnight, not the local day", () => {
    const message = liveShareMessage({ ...gameDay, date: "2026-01-01T00:00:00.000Z" }, "u");
    expect(message).toContain("Thursday, Jan 1");
  });
});

describe("liveQrFileName", () => {
  it("slugs the name and adds the date", () => {
    expect(liveQrFileName(gameDay)).toBe("kyuwing-live-monday-night-lights-2026-11-11.png");
  });

  it("drops characters that are unsafe in file names", () => {
    expect(liveQrFileName({ name: "Trial / Mega (demo)!", date: "2026-11-11T00:00:00.000Z" })).toBe(
      "kyuwing-live-trial-mega-demo-2026-11-11.png",
    );
  });

  it("still works when the name has no letters or digits", () => {
    expect(liveQrFileName({ name: "🏸🏸", date: "2026-11-11T00:00:00.000Z" })).toBe(
      "kyuwing-live-2026-11-11.png",
    );
  });
});
