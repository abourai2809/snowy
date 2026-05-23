import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoCatalogData } from "../../catalog/catalogApi";
import { listInventoryChecklist, resetDemoInventoryData, submitInventoryCount } from "../../inventory/inventoryApi";
import { correctInventoryCountItem } from "./correctionsApi";

describe("Admin corrections", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoInventoryData();
  });

  it("lets Admin correct historical inventory counts", async () => {
    const checklist = await listInventoryChecklist("store");
    const cups = checklist.find((item) => item.catalogItem.name === "Single Use Cups");
    expect(cups).toBeDefined();

    const count = await submitInventoryCount({
      locationId: "malsi",
      businessDate: "2026-05-20",
      scope: "store",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ catalogItemId: cups!.catalogItem.id, quantity: 120 }],
    });

    const corrected = await correctInventoryCountItem({
      countId: count.id,
      catalogItemId: cups!.catalogItem.id,
      quantity: 140,
      correctedBy: "staff-admin",
    });

    expect(corrected.status).toBe("corrected");
    expect(corrected.correctedBy).toBe("staff-admin");
    expect(corrected.items[0].quantity).toBe(140);
  });

  it("blocks Store Manager historical inventory corrections", async () => {
    const checklist = await listInventoryChecklist("store");
    const cups = checklist.find((item) => item.catalogItem.name === "Single Use Cups");
    expect(cups).toBeDefined();

    await submitInventoryCount({
      locationId: "malsi",
      businessDate: "2026-05-20",
      scope: "store",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ catalogItemId: cups!.catalogItem.id, quantity: 120 }],
    });

    await expect(
      submitInventoryCount({
        locationId: "malsi",
        businessDate: "2026-05-20",
        scope: "store",
        notes: "Manager correction",
        actorId: "staff-manager",
        actorRole: "store_manager",
        actorLocationId: "malsi",
        items: [{ catalogItemId: cups!.catalogItem.id, quantity: 130 }],
      }),
    ).rejects.toThrow("Only managers or Admin can correct inventory counts.");
  });
});
