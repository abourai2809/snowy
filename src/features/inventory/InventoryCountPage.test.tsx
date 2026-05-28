import { beforeEach, describe, expect, it } from "vitest";
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

    await user.click(screen.getByRole("button", { name: "Attendance" }));
    await screen.findByLabelText("Work store");
    await uploadCheckInSelfie(user);
    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect(await screen.findByText("Checked in")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Store" }));
    await screen.findAllByRole("button", { name: "Confirm Malsi" });
    expect(screen.queryByRole("form", { name: "Store supply checklist form" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Single Use Cups quantity")).not.toBeInTheDocument();
    const supplySection = await findSection("store-supply-checklist");
    await user.click(within(supplySection).getByRole("button", { name: "Confirm Malsi" }));
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
});

async function findSection(id: string): Promise<HTMLElement> {
  const section = document.querySelector(`#${id}`);
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

async function uploadCheckInSelfie(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(["fake-selfie"], "selfie.jpg", { type: "image/jpeg" });
  await user.upload(await screen.findByLabelText("Check-in selfie"), file);
}
