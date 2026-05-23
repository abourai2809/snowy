import { beforeEach, describe, expect, it } from "vitest";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, resetDemoLabData } from "../lab/labApi";
import {
  acceptIncomingDispatch,
  listDisplayPans,
  listIncomingDispatches,
  movePanToDisplay,
  resetDemoStoreData,
} from "./storeApi";

describe("store display movement", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("requires weight for a partial pan and moves valid backup pans to display", async () => {
    const panUuid = await seedAcceptedStorePan();

    await expect(
      movePanToDisplay({
        panUuid,
        storeLocationId: "malsi",
        fillState: "partial",
        weightKg: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
      }),
    ).rejects.toThrow("Partial pans require a weight.");

    await movePanToDisplay({
      panUuid,
      storeLocationId: "malsi",
      fillState: "partial",
      weightKg: 1.25,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    const display = await listDisplayPans("malsi");
    expect(display).toHaveLength(1);
    expect(display[0].currentWeightKg).toBe(1.25);
    expect(display[0].panRole).toBe("display");
  });
});

async function seedAcceptedStorePan() {
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
  await acceptIncomingDispatch({
    dispatchId: incoming[0].id,
    locationId: "malsi",
    notes: null,
    actorId: "staff-store",
    actorRole: "store_staff",
    actorLocationId: "malsi",
  });
  return production.pans[0].id;
}
