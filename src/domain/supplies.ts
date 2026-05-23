import type { CatalogItem } from "./catalog";

export type InventoryScope = "lab" | "store";
export type InventoryCountStatus = "submitted" | "corrected";

export interface InventoryChecklistItem {
  catalogItem: CatalogItem;
  unit: string;
  defaultMinQty: number;
}

export interface InventoryCount {
  id: string;
  locationId: string;
  businessDate: string;
  scope: InventoryScope;
  status: InventoryCountStatus;
  submittedBy: string | null;
  submittedAt: string;
  correctedBy: string | null;
  correctedAt: string | null;
  notes: string | null;
}

export interface InventoryCountItem {
  id: string;
  countId: string;
  catalogItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  notes: string | null;
}

export interface InventoryCountWithItems extends InventoryCount {
  items: InventoryCountItem[];
}

export interface InventoryBalance {
  id: string;
  locationId: string;
  catalogItemId: string;
  quantity: number;
  minQty: number;
  updatedAt: string;
}
