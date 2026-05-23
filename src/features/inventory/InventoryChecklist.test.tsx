import { beforeEach, describe, expect, it } from "vitest";
import {
  listCategories,
  resetDemoCatalogData,
  saveCatalogItem,
  setCatalogItemActive,
} from "../catalog/catalogApi";
import {
  listInventoryChecklist,
  listInventoryCounts,
  resetDemoInventoryData,
  submitInventoryCount,
} from "./inventoryApi";

describe("Inventory checklist data", () => {
  beforeEach(() => {
    resetDemoCatalogData();
    resetDemoInventoryData();
  });

  it("includes store and both-scoped supplies for store counts", async () => {
    const bothItem = await createBothScopedItem();

    const checklist = await listInventoryChecklist("store");

    expect(checklist.map((item) => item.catalogItem.name)).toEqual(
      expect.arrayContaining(["Single Use Cups", "Napkins", bothItem.name]),
    );
  });

  it("includes lab and both-scoped raw material supplies for lab counts", async () => {
    const bothItem = await createBothScopedItem();

    const checklist = await listInventoryChecklist("lab", ["raw_material", "supply", "packaging"]);

    expect(checklist.map((item) => item.catalogItem.name)).toEqual(
      expect.arrayContaining(["Full Cream Milk", "Fresh Cream", bothItem.name]),
    );
  });

  it("removes deactivated items from future checklists while preserving submitted count rows", async () => {
    const checklist = await listInventoryChecklist("store");
    const cups = checklist.find((item) => item.catalogItem.name === "Single Use Cups");
    expect(cups).toBeDefined();

    await submitInventoryCount({
      locationId: "malsi",
      businessDate: "2026-05-23",
      scope: "store",
      notes: null,
      actorId: "staff-store",
      actorRole: "store_staff",
      actorLocationId: "malsi",
      items: [{ catalogItemId: cups!.catalogItem.id, quantity: 120 }],
    });
    await setCatalogItemActive(cups!.catalogItem.id, false);

    const futureChecklist = await listInventoryChecklist("store");
    expect(futureChecklist.map((item) => item.catalogItem.name)).not.toContain("Single Use Cups");

    const counts = await listInventoryCounts("store");
    expect(counts[0].items.map((item) => item.itemName)).toContain("Single Use Cups");
  });
});

async function createBothScopedItem() {
  const categories = await listCategories(true);
  const category = categories.find((item) => item.categoryKey === "packaging-serving");
  expect(category).toBeDefined();

  return saveCatalogItem({
    itemKey: "shared-paper-bags",
    categoryId: category!.id,
    name: "Shared Paper Bags",
    itemKind: "packaging",
    scope: "both",
    unit: "pcs",
    defaultMinQty: 25,
    trackInventory: true,
  });
}
