import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../app/App";
import { renderApp, screen, userEvent } from "../../test/render";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { resetDemoAttendanceData } from "../attendance/attendanceApi";
import { resetDemoCatalogData } from "../catalog/catalogApi";
import { resetDemoDeepFreezerData } from "./deepFreezerApi";

describe("StoreDashboard", () => {
  beforeEach(() => {
    resetDemoStaffData();
    resetDemoAttendanceData();
    resetDemoCatalogData();
    resetDemoDeepFreezerData();
  });

  it("keeps the Store tab as an action hub and opens morning check after location confirmation", async () => {
    const user = userEvent.setup();
    renderApp(<App initialRole="store_staff" />);

    await checkInStoreStaff(user);
    await user.click(screen.getByRole("button", { name: "Store" }));

    expect(await screen.findByRole("button", { name: "Morning check" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm Malsi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Morning inventory verification form" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Morning check" }));

    expect(await screen.findByRole("button", { name: "Confirm Malsi" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Morning inventory verification form" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm Malsi" }));

    expect(await screen.findByRole("form", { name: "Morning inventory verification form" })).toBeInTheDocument();
  });
});

async function checkInStoreStaff(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Attendance" }));
  await screen.findByLabelText("Work store");
  await uploadCheckInSelfie(user);
  await user.click(screen.getByRole("button", { name: "Check in" }));
  expect(await screen.findByText("Checked in")).toBeInTheDocument();
}

async function uploadCheckInSelfie(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(["fake-selfie"], "selfie.jpg", { type: "image/jpeg" });
  await user.upload(await screen.findByLabelText("Check-in selfie"), file);
}
