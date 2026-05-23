import { beforeEach, describe, expect, it } from "vitest";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, resetDemoLabData } from "../lab/labApi";
import { acceptIncomingDispatch, listBackupPans, listIncomingDispatches, resetDemoStoreData } from "./storeApi";

describe("store incoming dispatches", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("accepts a dispatched pan into store backup inventory", async () => {
    const flavours = await listFlavours(true);
    const flavour = flavours.find((item) => item.shortCode === "PSP");
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
    expect(incoming).toHaveLength(1);
    expect(incoming[0].pans[0].panId).toBe("PSP-20260523-01");

    await acceptIncomingDispatch({
      dispatchId: incoming[0].id,
      locationId: "malsi",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(await listIncomingDispatches("malsi")).toHaveLength(0);
    const backup = await listBackupPans("malsi");
    expect(backup).toHaveLength(1);
    expect(backup[0].panRole).toBe("backup");
    expect(backup[0].status).toBe("received");
  });
});
