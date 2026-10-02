import { describe, expect, it } from "vitest";
import { dateGroupLabel } from "./date";

const now = new Date(2026, 9, 15, 9, 30);
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

describe("dateGroupLabel", () => {
  it("groups recent mail by day", () => {
    expect(dateGroupLabel(at(2026, 9, 15, 1), now)).toBe("Today");
    expect(dateGroupLabel(at(2026, 9, 14, 23), now)).toBe("Yesterday");
    expect(dateGroupLabel(at(2026, 9, 10), now)).toBe("This week");
  });

  it("falls back to month and year for older mail", () => {
    expect(dateGroupLabel(at(2026, 9, 2), now)).toBe("Earlier this month");
    expect(dateGroupLabel(at(2026, 7, 20), now)).toBe(
      new Date(2026, 7, 20).toLocaleDateString(undefined, { month: "long" }),
    );
    expect(dateGroupLabel(at(2025, 11, 31), now)).toBe("2025");
  });

  it("treats future timestamps as today", () => {
    expect(dateGroupLabel(at(2026, 9, 16), now)).toBe("Today");
  });
});
