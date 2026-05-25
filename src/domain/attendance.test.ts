import { describe, expect, it } from "vitest";
import { calculateHours, validateAttendanceLocation } from "./attendance";

describe("calculateHours", () => {
  it("returns decimal hours rounded to one decimal place", () => {
    expect(calculateHours("2026-05-25T09:00:00.000Z", "2026-05-25T09:24:00.000Z")).toBe(0.4);
    expect(calculateHours("2026-05-25T09:00:00.000Z", "2026-05-25T13:00:00.000Z")).toBe(4);
  });
});

describe("validateAttendanceLocation", () => {
  const rajpur = {
    id: "rajpur",
    name: "Rajpur Road",
    latitude: 30.3423856,
    longitude: 78.0611274,
    attendanceRadiusM: 150,
    attendanceAccuracyLimitM: 100,
  };

  it("accepts a precise reading inside the store radius", () => {
    const result = validateAttendanceLocation(rajpur, {
      latitude: 30.3424,
      longitude: 78.0611,
      accuracyM: 20,
    });

    expect(result.ok).toBe(true);
    expect(result.evidence.status).toBe("verified");
    expect(result.evidence.distanceM).toBeLessThanOrEqual(150);
  });

  it("rejects readings outside the store radius", () => {
    const result = validateAttendanceLocation(rajpur, {
      latitude: 30.345,
      longitude: 78.0611,
      accuracyM: 20,
    });

    expect(result.ok).toBe(false);
    expect(result.evidence.status).toBe("outside_radius");
  });

  it("rejects readings with poor accuracy", () => {
    const result = validateAttendanceLocation(rajpur, {
      latitude: 30.3424,
      longitude: 78.0611,
      accuracyM: 250,
    });

    expect(result.ok).toBe(false);
    expect(result.evidence.status).toBe("poor_accuracy");
  });
});
