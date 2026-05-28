import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { resetDemoAttendanceData } from "../attendance/attendanceApi";
import { resetDemoCatalogData } from "../catalog/catalogApi";
import { resetDemoInventoryData } from "./inventoryApi";
import { renderApp, screen, userEvent, within } from "../../test/render";

describe("InventoryCountPage", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoInventoryData();
    resetDemoStaffData();
    resetDemoAttendanceData();
  });

  it("lets store staff submit catalog-driven supply counts without adding new items", async () => {
    const user = userEvent.setup();
    renderApp(<App initialRole="store_staff" />);

    await checkInStoreStaff(user);

    await user.click(screen.getByRole("button", { name: "Store" }));
    expect(await screen.findByRole("button", { name: "Supply count" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Store supply checklist form" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Single Use Cups quantity")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Supply count" }));
    expect(await screen.findByRole("button", { name: "Confirm Malsi" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Single Use Cups quantity")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm Malsi" }));
    expect(await screen.findByText("Location verified for Malsi.")).toBeInTheDocument();
    const form = await screen.findByRole("form", { name: "Store supply checklist form" });

    await user.type(within(form).getByLabelText("Single Use Cups quantity"), "210");
    await user.type(within(form).getByLabelText("Napkins quantity"), "480");
    await user.type(within(form).getByLabelText("Waffle Cones quantity"), "90");
    await user.type(within(form).getByLabelText("Waffle Mix quantity"), "4");
    await user.click(within(form).getByRole("button", { name: "Submit count" }));

    expect(await screen.findByText("Inventory count submitted.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add item" })).not.toBeInTheDocument();
  });

  it("shows a mismatch warning before opening the selected store action", async () => {
    const user = userEvent.setup();
    renderApp(<App initialRole="store_staff" />);

    await checkInStoreStaff(user);
    mockDeviceLocation({ latitude: 30.3423856, longitude: 78.0611274 });

    await user.click(screen.getByRole("button", { name: "Store" }));
    await user.click(await screen.findByRole("button", { name: "Supply count" }));
    await user.click(await screen.findByRole("button", { name: "Confirm Malsi" }));

    expect(
      await screen.findByText("Browser location could not verify Malsi. Continue only if you are counting this store."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Single Use Cups quantity")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue to store supply checklist" }));

    expect(await screen.findByLabelText("Single Use Cups quantity")).toBeInTheDocument();
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

function mockDeviceLocation(location: { latitude: number; longitude: number }, accuracy = 20) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }),
    },
  });
}
