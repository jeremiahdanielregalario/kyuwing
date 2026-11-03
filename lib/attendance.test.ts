import { describe, expect, it } from "vitest";
import { nameKey, parseAttendanceBlock, parseNameList } from "./attendance";

const EXHIBIT_1 = `Official MEGA Game Day (KBC) 
Nov 2, 2026; Monday
10AM - 3PM

1. Jgops
2. Dylan
3. Shawn
4. Randolf
5. Lou
6. Paolo
7. Cali
8. Roniel
9. Loui
10. Carlos
11. Eli
12. Wai
13. JCB
14. Wan
15. Wade
16. XB
17. Ricky
18. Danyel
19. Yanni
20. Dani
21. Kyle
22. Harry
23. Uno
24. Denden
25. Wil
26. Jakey
27. Carl

Waitlist:
1. 
2. 
3. 
4. 
5. 
6. 
7. 
8. 
9. 
10.
11. 
12. Dane 
13. Miles
14. Dee
15. Emman
16. Gian
17. Perry
18. Serafin
19. Ian`;

describe("parseNameList", () => {
  it("strips numbering, blanks and duplicates", () => {
    expect(parseNameList("1. Jgops\n2. Dylan\n\n3) jgops\n- Miles\n• Dee")).toEqual([
      "Jgops",
      "Dylan",
      "Miles",
      "Dee",
    ]);
  });

  it("ignores pasted event headers, dates and times", () => {
    expect(
      parseNameList("Official MEGA Game Day (KBC)\nNov 2, 2026; Monday\n10AM - 3PM\n1. Jgops"),
    ).toEqual(["Jgops"]);
  });
});

describe("parseAttendanceBlock", () => {
  it("splits the played list from the waitlist", () => {
    const { played, waitlist } = parseAttendanceBlock(EXHIBIT_1);
    expect(played).toHaveLength(27);
    expect(played[0]).toBe("Jgops");
    expect(played.at(-1)).toBe("Carl");
    expect(waitlist).toEqual(["Dane", "Miles", "Dee", "Emman", "Gian", "Perry", "Serafin", "Ian"]);
  });
});

describe("nameKey", () => {
  it("normalises case and spacing", () => {
    expect(nameKey("  Jgops ")).toBe("jgops");
    expect(nameKey("Lou  Ian")).toBe("lou ian");
  });
});
