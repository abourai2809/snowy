import { beforeEach, describe, expect, it } from "vitest";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import { createDispatch, createProduction, resetDemoLabData } from "../lab/labApi";
import {
  acceptIncomingDispatch,
  listIncomingDispatches,
  movePanToDisplay,
  resetDemoStoreData,
  submitEodGelatoCount,
} from "./storeApi";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

describe("store EOD gelato counts", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("records only display pan weights", async () => {
    const [displayPanUuid, backupPanUuid] = await seedStorePans(2);
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "partial",
      weightKg: 1.2,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    await expect(
      submitEodGelatoCount({
        locationId: "malsi",
        businessDate: todayDate(),
        notes: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
        items: [
          { panUuid: displayPanUuid, weightKg: 1.1 },
          { panUuid: backupPanUuid, weightKg: 3.5 },
        ],
      }),
    ).rejects.toThrow("End-of-day gelato counts can only include display pans.");

    const count = await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ panUuid: displayPanUuid, weightKg: 1.1 }],
    });

    expect(count.status).toBe("submitted");
    expect(count.items).toHaveLength(1);
    expect(count.items[0].panId).toBe(displayPanUuid);
  });

  it("records display flavour weights when a pan ID is unavailable", async () => {
    const [displayPanUuid] = await seedStorePans(1);
    const flavour = (await listFlavours(true)).find((item) => item.shortCode === "PSP");
    expect(flavour).toBeDefined();
    await movePanToDisplay({
      panUuid: displayPanUuid,
      storeLocationId: "malsi",
      fillState: "partial",
      weightKg: 1.2,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    const count = await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ flavourId: flavour!.id, weightKg: 1.15 }],
    });

    expect(count.items).toHaveLength(1);
    expect(count.items[0].panId).toBeNull();
    expect(count.items[0].flavourId).toBe(flavour!.id);
    expect(count.items[0].weightKg).toBe(1.15);
  });

  it("lets Store Manager correct same-day counts", async () => {
    const [displayPanUuid] = await seedStorePans(1);
    await movePanToDisplay({
      panUuid: displayPanUuid,
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
      items: [{ panUuid: displayPanUuid, weightKg: 3.5 }],
    });

    const corrected = await submitEodGelatoCount({
      locationId: "malsi",
      businessDate: todayDate(),
      notes: "Corrected closing weight",
      actorId: "staff-manager",
      actorRole: "store_manager",
      actorLocationId: "malsi",
      items: [{ panUuid: displayPanUuid, weightKg: 3.2 }],
    });

    expect(corrected.status).toBe("corrected");
    expect(corrected.correctedBy).toBe("staff-manager");
    expect(corrected.items).toHaveLength(1);
    expect(corrected.items[0].weightKg).toBe(3.2);
  });

  it("blocks store staff from correcting another store", async () => {
    await expect(
      submitEodGelatoCount({
        locationId: "rajpur",
        businessDate: todayDate(),
        notes: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
        items: [],
      }),
    ).rejects.toThrow("Store users can only work in their assigned store.");
  });
});

async function seedStorePans(count: number) {
  const flavours = await listFlavours(true);
  const flavour = flavours.find((item) => item.shortCode === "PSP");
  expect(flavour).toBeDefined();

  const production = await createProduction({
    flavour: flavour!,
    productionDate: "2026-05-23",
    panCount: count,
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
  return production.pans.map((pan) => pan.id);
}
