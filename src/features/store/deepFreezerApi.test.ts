import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoStaffData } from "../admin/staff/staffApi";
import { listFlavours, resetDemoCatalogData } from "../catalog/catalogApi";
import {
  listStoreGelatoRequirements,
  resetDemoDeepFreezerData,
  saveStoreFlavourTarget,
  submitDeepFreezerCount,
} from "./deepFreezerApi";

describe("deep freezer inventory", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoStaffData();
    resetDemoDeepFreezerData();
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
});
