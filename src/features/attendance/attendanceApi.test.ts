import { beforeEach, describe, expect, it } from "vitest";
import { getDemoStaffByRole, resetDemoStaffData } from "../admin/staff/staffApi";
import {
  checkIn,
  checkOut,
  getCurrentAttendanceLocationId,
  listTodayLocationSegmentsForUser,
  resetDemoAttendanceData,
  switchAttendanceLocation,
} from "./attendanceApi";

describe("attendanceApi", () => {
  beforeEach(() => {
    resetDemoStaffData();
    resetDemoAttendanceData();
  });

  it("switches the active attendance location without ending worked hours", async () => {
    const profile = getDemoStaffByRole("store_staff");
    const checkedIn = await checkIn(profile, "rajpur", new Date("2026-05-27T09:00:00.000Z"), null, selfieFile());

    const switched = await switchAttendanceLocation(checkedIn, "malsi", new Date("2026-05-27T17:00:00.000Z"));

    expect(switched.checkOutAt).toBeNull();
    expect(switched.hours).toBeNull();
    expect(switched.locationId).toBe("malsi");
    await expect(getCurrentAttendanceLocationId(profile.id, "2026-05-27")).resolves.toBe("malsi");

    const segments = await listTodayLocationSegmentsForUser(profile.id, "2026-05-27");
    expect(segments).toMatchObject([
      { locationId: "rajpur", checkOutAt: "2026-05-27T17:00:00.000Z" },
      { locationId: "malsi", checkOutAt: null },
    ]);

    const checkedOut = await checkOut(switched, new Date("2026-05-27T21:00:00.000Z"));
    expect(checkedOut.hours).toBe(12);
    expect((await listTodayLocationSegmentsForUser(profile.id, "2026-05-27")).at(-1)?.checkOutAt).toBe(
      "2026-05-27T21:00:00.000Z",
    );
  });
});

function selfieFile() {
  return new File(["fake-selfie"], "selfie.jpg", { type: "image/jpeg" });
}
