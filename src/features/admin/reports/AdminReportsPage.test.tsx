import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../app/App";
import { getDemoStaffByRole, resetDemoStaffData } from "../staff/staffApi";
import { checkIn, checkOut, resetDemoAttendanceData } from "../../attendance/attendanceApi";
import { listFlavours, resetDemoCatalogData } from "../../catalog/catalogApi";
import { resetDemoInventoryData } from "../../inventory/inventoryApi";
import { createDispatch, createProduction, resetDemoLabData } from "../../lab/labApi";
import { resetDemoDeepFreezerData } from "../../store/deepFreezerApi";
import {
  acceptIncomingDispatch,
  listIncomingDispatches,
  movePanToDisplay,
  resetDemoStoreData,
  submitEodGelatoCount,
} from "../../store/storeApi";
import { fireEvent, renderApp, screen, userEvent, waitFor, within } from "../../../test/render";

describe("AdminReportsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetDemoStaffData();
    resetDemoAttendanceData();
    resetDemoCatalogData();
    resetDemoInventoryData();
    resetDemoLabData();
    resetDemoStoreData();
    resetDemoDeepFreezerData();
  });

  it("shows the attendance roster in Admin review and store oversight", async () => {
    const user = userEvent.setup();
    const storeStaff = getDemoStaffByRole("store_staff");
    const shiftStart = new Date();
    shiftStart.setUTCHours(9, 0, 0, 0);
    const firstShift = await checkIn(storeStaff, "rajpur", shiftStart, null, selfieFile());
    await checkOut(firstShift, new Date(new Date(firstShift.checkInAt).getTime() + 4 * 60 * 60 * 1000));
    const secondShiftStart = new Date(new Date(firstShift.checkInAt).getTime() + 5 * 60 * 60 * 1000);
    const secondShift = await checkIn(storeStaff, "mussoorie", secondShiftStart, null, selfieFile());
    await checkOut(secondShift, new Date(new Date(secondShift.checkInAt).getTime() + 4 * 60 * 60 * 1000));

    renderApp(<App initialRole="admin" />);
    await user.click(screen.getByRole("button", { name: "Stores" }));

    expect(await screen.findByText("Today roster")).toBeInTheDocument();
    expect(screen.getAllByText(storeStaff.name).length).toBeGreaterThan(0);
    expect(screen.getByText("Recent attendance selfies")).toBeInTheDocument();
    expect(screen.getAllByAltText(`Attendance selfie for ${storeStaff.name}`).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Selfie date")).toHaveValue(new Date().toISOString().slice(0, 10));
    await user.selectOptions(screen.getByLabelText("Selfie store"), "rajpur");
    await waitFor(() => {
      expect(screen.getAllByAltText(`Attendance selfie for ${storeStaff.name}`)).toHaveLength(1);
    });
    const filteredSelfieCard = screen.getAllByAltText(`Attendance selfie for ${storeStaff.name}`)[0].closest("article");
    expect(filteredSelfieCard).toBeTruthy();
    expect(within(filteredSelfieCard as HTMLElement).getByText(/Rajpur Road/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review" }));

    const todayKey = new Date().toISOString().slice(0, 10);
    expect(await screen.findByText("Attendance review")).toBeInTheDocument();
    expect(screen.getByLabelText("Attendance start date")).toHaveValue(todayKey);
    expect(screen.getByLabelText("Attendance end date")).toHaveValue(todayKey);
    const csvLink = screen.getByRole("link", { name: "Export CSV" });
    expect(csvLink).toHaveAttribute("download", `attendance-${todayKey}-to-${todayKey}.csv`);
    expect(csvLink.getAttribute("href")).toContain("data:text/csv");
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calculate salary" })).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Attendance review" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText("Malsi")).toBeInTheDocument();
    expect(within(table).queryByText("Rajpur Road")).not.toBeInTheDocument();
    expect(within(table).queryByText("Mussoorie")).not.toBeInTheDocument();
    expect(screen.getByText("Full day")).toBeInTheDocument();
    expect(screen.getByText("Attendance selfie review")).toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    const write = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({
      document: { write, close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    } as unknown as Window);
    await user.click(screen.getByRole("button", { name: "Edit hours" }));
    const manualHoursInput = screen.getByLabelText(`Manual hours ${storeStaff.name} ${todayKey}`);
    fireEvent.change(manualHoursInput, { target: { value: "9" } });
    expect(screen.getByText("Manual")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Calculate salary" }));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Salary calculation"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining(storeStaff.name));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("1 worked days x 800.00 daily salary"));

    fireEvent.change(screen.getByLabelText("Attendance start date"), { target: { value: "2026-05-20" } });
    fireEvent.change(screen.getByLabelText("Attendance end date"), { target: { value: "2026-05-20" } });

    expect(await screen.findByText("No attendance entries match this date range and filter.")).toBeInTheDocument();
  });

  it("shows running hours for staff who are still checked in today", async () => {
    const user = userEvent.setup();
    const storeStaff = getDemoStaffByRole("store_staff");
    const todayStart = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const shiftStart = new Date(Math.max(todayStart.getTime(), Date.now() - 2 * 60 * 60 * 1000));
    const expectedHours = Math.max(0, Math.round(((Date.now() - shiftStart.getTime()) / 3_600_000) * 10) / 10);
    const expectedHoursText = Number.isInteger(expectedHours) ? `${expectedHours}` : expectedHours.toFixed(1);
    await checkIn(storeStaff, "rajpur", shiftStart, null, selfieFile());

    renderApp(<App initialRole="admin" />);
    await user.click(screen.getAllByRole("button", { name: "Review" }).at(-1) as HTMLElement);

    const table = await screen.findByRole("table", { name: "Attendance review" });
    const staffRow = within(table).getByText(storeStaff.name).closest("tr");
    expect(staffRow).toBeTruthy();
    expect(within(staffRow as HTMLElement).getByText("Open")).toBeInTheDocument();
    expect(within(staffRow as HTMLElement).getByText("Open shift")).toBeInTheDocument();
    expect(within(staffRow as HTMLElement).getByText("Running")).toBeInTheDocument();
    expect(within(staffRow as HTMLElement).getByText(expectedHoursText)).toBeInTheDocument();
  });

  it("lets Admin correct historical EOD gelato weights", async () => {
    const user = userEvent.setup();
    await seedHistoricalEodGelatoCount();

    renderApp(<App initialRole="admin" />);
    await user.click(screen.getByRole("button", { name: "Stores" }));

    expect(await screen.findByText("EOD gelato corrections")).toBeInTheDocument();
    const correctionInput = await screen.findByLabelText("PIS-20260520-01 PISTACHTO");
    await user.clear(correctionInput);
    await user.type(correctionInput, "2.75");
    await user.click(screen.getByRole("button", { name: "Correct" }));

    expect(await screen.findByText("EOD gelato count corrected.")).toBeInTheDocument();
    expect(await screen.findByText("2026-05-20 / corrected")).toBeInTheDocument();
  });
});

async function seedHistoricalEodGelatoCount() {
  const flavour = (await listFlavours(true)).find((item) => item.shortCode === "PIS");
  expect(flavour).toBeDefined();

  const production = await createProduction({
    flavour: flavour!,
    productionDate: "2026-05-20",
    panCount: 1,
    fullWeightKg: 3.5,
    notes: null,
    producedBy: "staff-lab",
  });

  await createDispatch({
    panUuids: production.pans.map((pan) => pan.id),
    toLocationId: "malsi",
    dispatchedBy: "staff-lab",
    notes: null,
  });

  const incoming = await listIncomingDispatches("malsi");
  await acceptIncomingDispatch({
    dispatchId: incoming[0].id,
    locationId: "malsi",
    notes: null,
    actorId: "staff-store",
    actorRole: "store_staff",
    actorLocationId: "malsi",
  });

  await movePanToDisplay({
    panUuid: production.pans[0].id,
    storeLocationId: "malsi",
    fillState: "full",
    weightKg: null,
    actorId: "staff-store",
    actorRole: "store_staff",
    actorLocationId: "malsi",
  });

  await submitEodGelatoCount({
    locationId: "malsi",
    businessDate: "2026-05-20",
    notes: null,
    actorId: "staff-store",
    actorRole: "store_staff",
    actorLocationId: "malsi",
    items: [{ panUuid: production.pans[0].id, weightKg: 3.5 }],
  });
}

function selfieFile() {
  return new File(["fake-selfie"], "selfie.jpg", { type: "image/jpeg" });
}
