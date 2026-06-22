import { beforeEach, describe, expect, it } from "vitest";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, resetDemoLabData } from "../lab/labApi";
import { resetDemoDeepFreezerData } from "./deepFreezerApi";
import {
  acceptEmptyPanReturn,
  acceptIncomingDispatch,
  createEmptyPanReturn,
  listEmptyPanCountsByStore,
  listEmptyPanReturns,
  listIncomingDispatches,
  listPhysicalEmptyPanCounts,
  movePanToDisplay,
  resetDemoStoreData,
  resolvePhysicalEmptyPanCount,
  submitEodGelatoCount,
  submitPhysicalEmptyPanCount,
} from "./storeApi";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

describe("empty pan workflow", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoLabData();
    resetDemoStoreData();
    resetDemoDeepFreezerData();
  });

  it("tracks store empty-pan returns in transit and after lab acceptance", async () => {
    await seedEmptyStorePan();

    await expect(listEmptyPanCountsByStore("malsi")).resolves.toEqual([{ locationId: "malsi", emptyPanCount: 1 }]);

    const emptyReturn = await createEmptyPanReturn({
      sourceLocationId: "malsi",
      quantity: 1,
      notes: "Returning one empty pan.",
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(emptyReturn.status).toBe("in_transit");
    await expect(listEmptyPanCountsByStore("malsi")).resolves.toEqual([{ locationId: "malsi", emptyPanCount: 0 }]);
    await expect(
      createEmptyPanReturn({
        sourceLocationId: "malsi",
        quantity: 1,
        notes: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
      }),
    ).rejects.toThrow("Cannot return more empty pans than the app-calculated store empty-pan count.");

    await acceptEmptyPanReturn({
      returnId: emptyReturn.id,
      notes: "Received.",
      actorId: "staff-lab",
      actorRole: "lab_staff",
      actorLocationId: "lab",
    });

    const returns = await listEmptyPanReturns();
    expect(returns[0]).toEqual(expect.objectContaining({ id: emptyReturn.id, status: "accepted" }));
    await expect(listEmptyPanCountsByStore("malsi")).resolves.toEqual([{ locationId: "malsi", emptyPanCount: 0 }]);
  });

  it("flags physical empty-pan count discrepancies for manager review", async () => {
    await seedEmptyStorePan();

    const flagged = await submitPhysicalEmptyPanCount({
      locationId: "malsi",
      businessDate: todayDate(),
      countType: "eod",
      physicalCount: 0,
      notes: "One pan has partial gelato but is treated as empty.",
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(flagged).toEqual(
      expect.objectContaining({
        appCalculatedCount: 1,
        physicalCount: 0,
        status: "flagged",
        variance: -1,
      }),
    );

    const resolved = await resolvePhysicalEmptyPanCount({
      countId: flagged.id,
      notes: "Manager verified the partial pan.",
      actorId: "staff-manager",
      actorRole: "store_manager",
      actorLocationId: "malsi",
    });

    expect(resolved.status).toBe("resolved");
    expect(await listPhysicalEmptyPanCounts("malsi")).toEqual([expect.objectContaining({ id: flagged.id, status: "resolved" })]);
  });
});

async function seedEmptyStorePan() {
  const flavour = (await listFlavours(true)).find((item) => item.shortCode === "PIS");
  expect(flavour).toBeDefined();
  const production = await createProduction({
    flavour: flavour!,
    productionDate: "2026-05-23",
    panCount: 1,
    fullWeightKg: 3.5,
    notes: null,
    producedBy: "staff-lab",
  });
  await createDispatch({
    panUuids: [production.pans[0].id],
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
    businessDate: todayDate(),
    notes: null,
    actorId: "staff-store",
    actorRole: "store_staff",
    actorLocationId: "malsi",
    items: [{ panUuid: production.pans[0].id, weightKg: 0 }],
  });
}
