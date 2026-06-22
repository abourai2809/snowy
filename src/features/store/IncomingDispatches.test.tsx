import { beforeEach, describe, expect, it } from "vitest";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, resetDemoLabData } from "../lab/labApi";
import {
  acceptIncomingDispatch,
  listBackupPans,
  listIncomingDispatches,
  listRejectedDispatches,
  rejectIncomingDispatch,
  resetDemoStoreData,
  overturnRejectedDispatch,
} from "./storeApi";

describe("store incoming dispatches", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("accepts a dispatched pan into store backup inventory", async () => {
    await seedIncomingDispatch();

    const incoming = await listIncomingDispatches("malsi");
    expect(incoming).toHaveLength(1);
    expect(incoming[0].pans[0].panId).toBe("PIS-20260523-01");

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

  it("lets the store overturn a rejected dispatch and accept it into backup inventory", async () => {
    await seedIncomingDispatch();

    const incoming = await listIncomingDispatches("malsi");
    await rejectIncomingDispatch({
      dispatchId: incoming[0].id,
      locationId: "malsi",
      notes: "Rejected by mistake.",
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(await listIncomingDispatches("malsi")).toHaveLength(0);
    const rejected = await listRejectedDispatches("malsi");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].pans[0].panId).toBe("PIS-20260523-01");

    await overturnRejectedDispatch({
      dispatchId: rejected[0].id,
      locationId: "malsi",
      notes: "Accepted after correction.",
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    expect(await listRejectedDispatches("malsi")).toHaveLength(0);
    const backup = await listBackupPans("malsi");
    expect(backup).toEqual([expect.objectContaining({ panId: "PIS-20260523-01", status: "received" })]);
  });
});

async function seedIncomingDispatch() {
  const flavours = await listFlavours(true);
  const flavour = flavours.find((item) => item.shortCode === "PIS");
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
}
