import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../../app/App";
import { getDemoStaffByRole, resetDemoStaffData } from "../staff/staffApi";
import { checkIn, resetDemoAttendanceData } from "../../attendance/attendanceApi";
import { listFlavours, resetDemoCatalogData } from "../../catalog/catalogApi";
import { resetDemoInventoryData } from "../../inventory/inventoryApi";
import { createDispatch, createProduction, resetDemoLabData } from "../../lab/labApi";
import {
  acceptIncomingDispatch,
  listIncomingDispatches,
  movePanToDisplay,
  resetDemoStoreData,
  submitEodGelatoCount,
} from "../../store/storeApi";
import { renderApp, screen, userEvent } from "../../../test/render";

describe("AdminReportsPage", () => {
  beforeEach(() => {
    resetDemoStaffData();
    resetDemoAttendanceData();
    resetDemoCatalogData();
    resetDemoInventoryData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("shows the attendance roster in Admin store oversight", async () => {
    const user = userEvent.setup();
    const storeStaff = getDemoStaffByRole("store_staff");
    await checkIn(storeStaff, new Date());

    renderApp(<App initialRole="admin" />);
    await user.click(screen.getByRole("button", { name: "Stores" }));

    expect(await screen.findByText("Today roster")).toBeInTheDocument();
    expect(screen.getByText(storeStaff.name)).toBeInTheDocument();
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
