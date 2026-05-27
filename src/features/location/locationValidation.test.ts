import { describe, expect, it } from "vitest";
import type { LocationOption } from "../../domain/roles";
import { validateReadingForStore } from "./locationValidation";

describe("locationValidation", () => {
  it("verifies a reading inside the store radius", () => {
    expect(
      validateReadingForStore(malsi, {
        latitude: 30.394992,
        longitude: 78.0748199,
        accuracyM: 20,
      }),
    ).toEqual({
      status: "verified",
      message: "Location verified for Malsi.",
    });
  });

  it("returns a warning instead of blocking for a different store location", () => {
    expect(
      validateReadingForStore(malsi, {
        latitude: 30.3423856,
        longitude: 78.0611274,
        accuracyM: 20,
      }),
    ).toEqual({
      status: "warning",
      message: "Browser location could not verify Malsi. Continue only if you are counting this store.",
    });
  });
});

const malsi: LocationOption = {
  id: "malsi",
  name: "Malsi",
  type: "store",
  active: true,
  latitude: 30.394992,
  longitude: 78.0748199,
  attendanceRadiusM: 150,
  attendanceAccuracyLimitM: 100,
};
