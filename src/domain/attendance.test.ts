import { describe, expect, it } from "vitest";
import { calculateHours } from "./attendance";

describe("calculateHours", () => {
  it("returns decimal hours rounded to one decimal place", () => {
    expect(calculateHours("2026-05-25T09:00:00.000Z", "2026-05-25T09:24:00.000Z")).toBe(0.4);
    expect(calculateHours("2026-05-25T09:00:00.000Z", "2026-05-25T13:00:00.000Z")).toBe(4);
  });
});
