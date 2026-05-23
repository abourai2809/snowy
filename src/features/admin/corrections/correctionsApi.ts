import type { InventoryCountWithItems } from "../../../domain/supplies";
import { listInventoryCounts, submitInventoryCount } from "../../inventory/inventoryApi";

export interface InventoryCorrectionInput {
  countId: string;
  catalogItemId: string;
  quantity: number;
  correctedBy: string | null;
}

export async function correctInventoryCountItem(input: InventoryCorrectionInput): Promise<InventoryCountWithItems> {
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new Error("Corrected quantity must be zero or more.");
  }

  const counts = await listInventoryCounts();
  const count = counts.find((item) => item.id === input.countId);
  if (!count) {
    throw new Error("Inventory count not found.");
  }

  if (!count.items.some((item) => item.catalogItemId === input.catalogItemId)) {
    throw new Error("Inventory count item not found.");
  }

  return submitInventoryCount({
    locationId: count.locationId,
    businessDate: count.businessDate,
    scope: count.scope,
    notes: "Admin correction",
    actorId: input.correctedBy,
    actorRole: "admin",
    actorLocationId: null,
    items: count.items.map((item) => ({
      catalogItemId: item.catalogItemId,
      quantity: item.catalogItemId === input.catalogItemId ? input.quantity : item.quantity,
      notes: item.notes,
    })),
  });
}
