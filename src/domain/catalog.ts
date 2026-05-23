export type CatalogScope = "lab" | "store" | "both";
export type CatalogItemKind = "raw_material" | "supply" | "packaging" | "product";

export interface CatalogCategory {
  id: string;
  categoryKey: string;
  name: string;
  itemKind: CatalogItemKind;
  scope: CatalogScope;
  active: boolean;
}

export interface CatalogItem {
  id: string;
  itemKey: string;
  categoryId: string;
  name: string;
  itemKind: CatalogItemKind;
  scope: CatalogScope;
  unit: string;
  defaultMinQty: number;
  trackInventory: boolean;
  active: boolean;
}

export interface Product {
  id: string;
  productKey: string;
  name: string;
  catalogItemId: string | null;
  flavourId: string | null;
  scope: CatalogScope;
  trackInventory: boolean;
  active: boolean;
}

export const CATALOG_SCOPE_LABELS: Record<CatalogScope, string> = {
  lab: "Lab",
  store: "Store",
  both: "Both",
};

export const CATALOG_KIND_LABELS: Record<CatalogItemKind, string> = {
  raw_material: "Raw material",
  supply: "Supply",
  packaging: "Packaging",
  product: "Product",
};

export function itemMatchesScope(item: { scope: CatalogScope }, scope: "lab" | "store"): boolean {
  return item.scope === scope || item.scope === "both";
}
