import { beforeEach, describe, expect, it } from "vitest";
import { renderApp, screen, userEvent, waitFor } from "../../test/render";
import { App } from "../../app/App";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { resetDemoAttendanceData } from "./attendanceApi";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, resetDemoLabData } from "../lab/labApi";
import { resetDemoStoreData } from "../store/storeApi";

describe("AttendancePage", () => {
  beforeEach(() => {
    resetDemoStaffData();
    resetDemoAttendanceData();
    resetDemoCatalogData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("lets staff check in and check out once per day", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="store_staff" />);
    await user.click(screen.getByRole("button", { name: "Attendance" }));

    expect(await screen.findByText("Not checked in")).toBeInTheDocument();
    expect(await screen.findByLabelText("Work store")).toHaveValue("malsi");

    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect(await screen.findByText("Checked in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check in" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Check out" }));
    expect(await screen.findByText("Checked out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check out" })).toBeDisabled();
  });

  it("shows today's attendance roster to Admin", async () => {
    const staffUser = userEvent.setup();
    const { unmount } = renderApp(<App initialRole="store_staff" />);
    await staffUser.click(screen.getByRole("button", { name: "Attendance" }));
    await staffUser.click(await screen.findByRole("button", { name: "Check in" }));
    await waitFor(() => expect(screen.getByText("Checked in")).toBeInTheDocument());
    unmount();

    renderApp(<App initialRole="admin" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Attendance" }));

    expect(await screen.findByLabelText("Attendance roster")).toHaveTextContent("Sneha Joshi");
  });

  it("uses the checked-in store as the active store context", async () => {
    const user = userEvent.setup();
    await seedIncomingRajpurPan();

    renderApp(<App initialRole="store_staff" />);
    await user.click(screen.getByRole("button", { name: "Attendance" }));
    await user.selectOptions(await screen.findByLabelText("Work store"), "rajpur");
    await user.click(screen.getByRole("button", { name: "Check in" }));

    await waitFor(() => expect(screen.getByText("Checked in")).toBeInTheDocument());
    expect(screen.getAllByText("Rajpur Road").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Store" }));

    expect(await screen.findByText(/PIS-20260524-01/)).toBeInTheDocument();
  });

  it("blocks store workflows until store staff check in", async () => {
    const user = userEvent.setup();

    renderApp(<App initialRole="store_staff" />);
    await user.click(screen.getByRole("button", { name: "Store" }));

    expect(await screen.findByText("Check in to select your store before using store workflows.")).toBeInTheDocument();
  });
});

async function seedIncomingRajpurPan() {
  const flavour = (await listFlavours(true)).find((item) => item.shortCode === "PIS");
  expect(flavour).toBeDefined();

  const production = await createProduction({
    flavour: flavour!,
    productionDate: "2026-05-24",
    panCount: 1,
    fullWeightKg: 3.5,
    notes: null,
    producedBy: "staff-lab",
  });

  await createDispatch({
    panUuids: production.pans.map((pan) => pan.id),
    toLocationId: "rajpur",
    dispatchedBy: "staff-lab",
    notes: null,
  });
}
