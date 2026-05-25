import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import {
  listProjectedDeepFreezerBalances,
  listStoreGelatoRequirements,
  resetDemoDeepFreezerData,
  saveStoreFlavourTarget,
  submitDeepFreezerCount,
} from "./deepFreezerApi";
import { createDispatch, createProduction, resetDemoLabData } from "../lab/labApi";
import { acceptIncomingDispatch, movePanToDisplay, resetDemoStoreData } from "./storeApi";

describe("deep freezer inventory", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoStaffData();
    resetDemoDeepFreezerData();
    resetDemoLabData();
    resetDemoStoreData();
  });

  it("keeps store freezer counts separate and generates target-based lab requirements", async () => {
    const flavour = (await listFlavours(true)).find((item) => item.shortCode === "PIS");
    expect(flavour).toBeDefined();

    await submitDeepFreezerCount({
      locationId: "malsi",
      businessDate: "2026-05-25",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ flavourId: flavour!.id, weightKg: 2.5 }],
    });
    await submitDeepFreezerCount({
      locationId: "rajpur",
      businessDate: "2026-05-25",
      notes: null,
      actorId: "staff-manager",
      actorRole: "store_manager",
      actorLocationId: "rajpur",
      items: [{ flavourId: flavour!.id, weightKg: 5 }],
    });
    await saveStoreFlavourTarget({
      locationId: "malsi",
      flavourId: flavour!.id,
      targetWeightKg: 6,
      actorRole: "admin",
    });
    await saveStoreFlavourTarget({
      locationId: "rajpur",
      flavourId: flavour!.id,
      targetWeightKg: 6,
      actorRole: "admin",
    });

    const requirements = await listStoreGelatoRequirements();

    expect(requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locationId: "malsi",
          flavourId: flavour!.id,
          currentWeightKg: 2.5,
          targetWeightKg: 6,
          neededWeightKg: 3.5,
        }),
        expect.objectContaining({
          locationId: "rajpur",
          flavourId: flavour!.id,
          currentWeightKg: 5,
          targetWeightKg: 6,
          neededWeightKg: 1,
        }),
      ]),
    );
  });

  it("blocks store staff from counting another store", async () => {
    const flavour = (await listFlavours(true))[0];

    await expect(
      submitDeepFreezerCount({
        locationId: "rajpur",
        businessDate: "2026-05-25",
        notes: null,
        actorId: "staff-store",
        actorRole: "store_staff",
        actorLocationId: "malsi",
        items: [{ flavourId: flavour.id, weightKg: 2 }],
      }),
    ).rejects.toThrow("Store users can only count deep freezer inventory for their active store.");
  });

  it("projects freezer balances from accepted receipts minus display movements", async () => {
    const flavour = (await listFlavours(true)).find((item) => item.shortCode === "PIS");
    expect(flavour).toBeDefined();

    await submitDeepFreezerCount({
      locationId: "malsi",
      businessDate: "2020-01-01",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ flavourId: flavour!.id, weightKg: 2 }],
    });
    await saveStoreFlavourTarget({
      locationId: "malsi",
      flavourId: flavour!.id,
      targetWeightKg: 6,
      actorRole: "admin",
    });

    const production = await createProduction({
      flavour: flavour!,
      productionDate: "2026-05-24",
      panCount: 1,
      fullWeightKg: 3,
      notes: null,
      producedBy: "staff-lab",
    });
    const dispatch = await createDispatch({
      panUuids: production.pans.map((pan) => pan.id),
      toLocationId: "malsi",
      dispatchedBy: "staff-lab",
      notes: null,
    });
    await acceptIncomingDispatch({
      dispatchId: dispatch.id,
      locationId: "malsi",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    let balances = await listProjectedDeepFreezerBalances("malsi");
    expect(balances.find((item) => item.flavourId === flavour!.id)).toEqual(
      expect.objectContaining({
        baseWeightKg: 2,
        receivedWeightKg: 3,
        displayMovedWeightKg: 0,
        currentWeightKg: 5,
      }),
    );
    expect(await listStoreGelatoRequirements()).toEqual([
      expect.objectContaining({
        locationId: "malsi",
        flavourId: flavour!.id,
        currentWeightKg: 5,
        neededWeightKg: 1,
      }),
    ]);

    await movePanToDisplay({
      panUuid: production.pans[0].id,
      storeLocationId: "malsi",
      fillState: "full",
      weightKg: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
    });

    balances = await listProjectedDeepFreezerBalances("malsi");
    expect(balances.find((item) => item.flavourId === flavour!.id)).toEqual(
      expect.objectContaining({
        baseWeightKg: 2,
        receivedWeightKg: 3,
        displayMovedWeightKg: 3,
        currentWeightKg: 2,
      }),
    );
    expect(await listStoreGelatoRequirements()).toEqual([
      expect.objectContaining({
        locationId: "malsi",
        flavourId: flavour!.id,
        currentWeightKg: 2,
        neededWeightKg: 4,
      }),
    ]);
  });
});
