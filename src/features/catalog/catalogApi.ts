import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import type { CatalogCategory, CatalogItem, CatalogItemKind, CatalogScope, Product } from "../../domain/catalog";
import { itemMatchesScope } from "../../domain/catalog";
import type { Flavour } from "../../domain/flavours";

export type CatalogItemInput = Omit<CatalogItem, "id" | "active">;
export type CatalogCategoryInput = Omit<CatalogCategory, "id" | "active">;
export type FlavourInput = Omit<Flavour, "id" | "active">;
export type ProductInput = Omit<Product, "id" | "active">;

const initialFlavours: Flavour[] = [
  ["Lemon Mint Sorbet", "LEM", false, true],
  ["Bubblegum", "BUB", false, false],
  ["Peanut Butter", "PEA", false, false],
  ["Oreo", "ORE", false, false],
  ["Caramalised Banana", "CAR", false, false],
  ["Kit Kat", "KIT", false, false],
  ["Tender Coconut", "TEN", false, false],
  ["Black Sesame", "BLA", false, false],
  ["Seasonal Lychee", "LYC", true, false],
  ["Davidoff Coffee", "DAV", false, false],
  ["Roasted Almond", "ROA", false, false],
  ["Apple Cinnamon Pie", "APP", false, false],
  ["French Vanilla", "FRE", false, false],
  ["Mix Berry Sorbet", "MIX", false, true],
  ["Popcorn", "POP", false, false],
  ["Salted Malted Cookie Dough", "SMC", false, false],
  ["Seasonal Chikoo", "CHI", true, false],
  ["Mango Alphonso", "MAN", false, false],
  ["Premium Dark Choc Fudge Brownie", "DFB", false, false],
  ["Rhododendron Sorbet", "RHO", true, true],
  ["Pineapple Compote", "PIN", false, false],
  ["Strawberry Matcha Latte", "SML", false, false],
  ["Lotus Biscoff", "LOT", false, false],
  ["Seasonal Custard Apple", "CUS", true, false],
  ["Callebaut Belgian Chocolate", "CBC", false, false],
  ["Mandarin Orange", "MOR", false, false],
  ["Tiramisu", "TIR", false, false],
  ["Strawberry Cheesecake", "STC", false, false],
  ["Ferrero", "FER", false, false],
  ["Salted Butter Caramel", "SBC", false, false],
  ["Sugar Free Dairy Free Chocolate", "SFD", false, false],
  ["Pure Sicilian Pistachio", "PSP", false, false],
].map(([name, shortCode, seasonal, sorbet], index) => ({
  id: `flavour-${index + 1}`,
  name: String(name),
  shortCode: String(shortCode),
  seasonal: Boolean(seasonal),
  sorbet: Boolean(sorbet),
  active: true,
}));

const initialCategories: CatalogCategory[] = [
  ["cat-raw-materials", "raw-materials", "Raw Materials", "raw_material", "lab"],
  ["cat-lab-supplies", "lab-supplies", "Lab Supplies", "supply", "lab"],
  ["cat-store-supplies", "store-supplies", "Store Supplies", "supply", "store"],
  ["cat-packaging-serving", "packaging-serving", "Packaging / Serving Supplies", "packaging", "both"],
  ["cat-products-sold", "products-sold", "Products Sold", "product", "store"],
].map(([id, categoryKey, name, itemKind, scope]) => ({
  id: String(id),
  categoryKey: String(categoryKey),
  name: String(name),
  itemKind: itemKind as CatalogItemKind,
  scope: scope as CatalogScope,
  active: true,
}));

const initialItems: CatalogItem[] = [
  ["item-full-cream-milk", "raw-full-cream-milk", "cat-raw-materials", "Full Cream Milk", "raw_material", "lab", "litres", 30],
  ["item-fresh-cream", "raw-fresh-cream", "cat-raw-materials", "Fresh Cream", "raw_material", "lab", "litres", 15],
  ["item-sugar", "raw-sugar", "cat-raw-materials", "Sugar", "raw_material", "lab", "kg", 20],
  ["item-pistachio-paste", "raw-pistachio-paste", "cat-raw-materials", "Pistachio Paste", "raw_material", "lab", "kg", 5],
  ["item-cocoa-powder", "raw-cocoa-powder", "cat-raw-materials", "Cocoa Powder", "raw_material", "lab", "kg", 4],
  ["item-vanilla-extract", "raw-vanilla-extract", "cat-raw-materials", "Vanilla Extract", "raw_material", "lab", "ml", 200],
  ["item-stabiliser-mix", "raw-stabiliser-mix", "cat-raw-materials", "Stabiliser Mix", "raw_material", "lab", "g", 200],
  ["item-500ml-container", "lab-gelato-containers-500ml", "cat-lab-supplies", "Gelato Containers 500ml", "supply", "lab", "pcs", 50],
  ["item-1l-container", "lab-gelato-containers-1l", "cat-lab-supplies", "Gelato Containers 1L", "supply", "lab", "pcs", 30],
  ["item-piping-bags", "lab-piping-bags", "cat-lab-supplies", "Piping Bags", "supply", "lab", "pcs", 40],
  ["item-hairnets", "lab-hairnets", "cat-lab-supplies", "Hairnets", "supply", "lab", "pcs", 20],
  ["item-gloves", "lab-gloves-pairs", "cat-lab-supplies", "Gloves (pairs)", "supply", "lab", "pairs", 25],
  ["item-cling-wrap", "lab-food-safe-cling-wrap", "cat-lab-supplies", "Food-safe Cling Wrap", "supply", "lab", "rolls", 3],
  ["item-cups", "store-single-use-cups", "cat-store-supplies", "Single Use Cups", "packaging", "store", "pcs", 200],
  ["item-napkins", "store-napkins", "cat-store-supplies", "Napkins", "supply", "store", "pcs", 500],
  ["item-waffle-cones", "store-waffle-cones", "cat-store-supplies", "Waffle Cones", "product", "store", "pcs", 100],
  ["item-waffle-mix", "store-waffle-mix", "cat-store-supplies", "Waffle Mix", "raw_material", "store", "kg", 3],
].map(([id, itemKey, categoryId, name, itemKind, scope, unit, defaultMinQty]) => ({
  id: String(id),
  itemKey: String(itemKey),
  categoryId: String(categoryId),
  name: String(name),
  itemKind: itemKind as CatalogItemKind,
  scope: scope as CatalogScope,
  unit: String(unit),
  defaultMinQty: Number(defaultMinQty),
  trackInventory: true,
  active: true,
}));

const initialProducts: Product[] = [
  {
    id: "product-waffle-cone",
    productKey: "store-waffle-cone",
    name: "Waffle Cone",
    catalogItemId: "item-waffle-cones",
    flavourId: null,
    scope: "store",
    trackInventory: true,
    active: true,
  },
];

let demoFlavours = clone(initialFlavours);
let demoCategories = clone(initialCategories);
let demoItems = clone(initialItems);
let demoProducts = clone(initialProducts);

function clone<T>(items: T[]): T[] {
  return items.map((item) => ({ ...item }));
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function mapFlavour(row: Record<string, unknown>): Flavour {
  return {
    id: String(row.id),
    name: String(row.name),
    shortCode: String(row.short_code),
    seasonal: Boolean(row.seasonal),
    sorbet: Boolean(row.sorbet),
    active: Boolean(row.active),
  };
}

function mapCategory(row: Record<string, unknown>): CatalogCategory {
  return {
    id: String(row.id),
    categoryKey: String(row.category_key),
    name: String(row.name),
    itemKind: row.item_kind as CatalogItemKind,
    scope: row.scope as CatalogScope,
    active: Boolean(row.active),
  };
}

function mapItem(row: Record<string, unknown>): CatalogItem {
  return {
    id: String(row.id),
    itemKey: String(row.item_key),
    categoryId: String(row.category_id),
    name: String(row.name),
    itemKind: row.item_kind as CatalogItemKind,
    scope: row.scope as CatalogScope,
    unit: String(row.unit),
    defaultMinQty: Number(row.default_min_qty ?? 0),
    trackInventory: Boolean(row.track_inventory),
    active: Boolean(row.active),
  };
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    productKey: String(row.product_key),
    name: String(row.name),
    catalogItemId: row.catalog_item_id ? String(row.catalog_item_id) : null,
    flavourId: row.flavour_id ? String(row.flavour_id) : null,
    scope: row.scope as CatalogScope,
    trackInventory: Boolean(row.track_inventory),
    active: Boolean(row.active),
  };
}

export function resetDemoCatalogData() {
  demoFlavours = clone(initialFlavours);
  demoCategories = clone(initialCategories);
  demoItems = clone(initialItems);
  demoProducts = clone(initialProducts);
}

export async function listFlavours(activeOnly = false): Promise<Flavour[]> {
  if (!isSupabaseConfigured) {
    return demoFlavours.filter((flavour) => !activeOnly || flavour.active);
  }

  let query = requireSupabaseClient().from("flavours").select("*").order("name");
  if (activeOnly) {
    query = query.eq("active", true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapFlavour);
}

export async function saveFlavour(input: FlavourInput, flavourId?: string): Promise<Flavour> {
  const payload = {
    name: input.name.trim(),
    shortCode: normalizeCode(input.shortCode),
    seasonal: input.seasonal,
    sorbet: input.sorbet,
  };

  if (!payload.name || !payload.shortCode) {
    throw new Error("Flavour name and short code are required.");
  }

  if (!isSupabaseConfigured) {
    const duplicate = demoFlavours.find(
      (flavour) => flavour.shortCode === payload.shortCode && flavour.id !== flavourId,
    );
    if (duplicate) {
      throw new Error("Short code is already used by another flavour.");
    }

    if (flavourId) {
      const existing = demoFlavours.find((flavour) => flavour.id === flavourId);
      if (!existing) throw new Error("Flavour not found.");
      Object.assign(existing, payload);
      return { ...existing };
    }

    const created = { id: makeId("flavour"), active: true, ...payload };
    demoFlavours.push(created);
    return created;
  }

  const query = flavourId
    ? requireSupabaseClient().from("flavours").update({
        name: payload.name,
        short_code: payload.shortCode,
        seasonal: payload.seasonal,
        sorbet: payload.sorbet,
      }).eq("id", flavourId).select().single()
    : requireSupabaseClient().from("flavours").insert({
        name: payload.name,
        short_code: payload.shortCode,
        seasonal: payload.seasonal,
        sorbet: payload.sorbet,
      }).select().single();

  const { data, error } = await query;
  if (error) throw error;
  return mapFlavour(data);
}

export async function setFlavourActive(flavourId: string, active: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    const existing = demoFlavours.find((flavour) => flavour.id === flavourId);
    if (!existing) throw new Error("Flavour not found.");
    existing.active = active;
    return;
  }

  const { error } = await requireSupabaseClient().from("flavours").update({ active }).eq("id", flavourId);
  if (error) throw error;
}

export async function removeFlavour(flavourId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    demoFlavours = demoFlavours.filter((flavour) => flavour.id !== flavourId);
    return;
  }

  const { error } = await requireSupabaseClient().from("flavours").delete().eq("id", flavourId);
  if (error) throw error;
}

export async function listCategories(activeOnly = false): Promise<CatalogCategory[]> {
  if (!isSupabaseConfigured) {
    return demoCategories.filter((category) => !activeOnly || category.active);
  }

  let query = requireSupabaseClient().from("catalog_categories").select("*").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapCategory);
}

export async function saveCategory(input: CatalogCategoryInput, categoryId?: string): Promise<CatalogCategory> {
  if (!input.categoryKey || !input.name) {
    throw new Error("Category key and name are required.");
  }

  if (!isSupabaseConfigured) {
    if (categoryId) {
      const existing = demoCategories.find((category) => category.id === categoryId);
      if (!existing) throw new Error("Category not found.");
      Object.assign(existing, input);
      return { ...existing };
    }

    const created = { id: makeId("category"), active: true, ...input };
    demoCategories.push(created);
    return created;
  }

  const payload = {
    category_key: input.categoryKey,
    name: input.name,
    item_kind: input.itemKind,
    scope: input.scope,
  };
  const query = categoryId
    ? requireSupabaseClient().from("catalog_categories").update(payload).eq("id", categoryId).select().single()
    : requireSupabaseClient().from("catalog_categories").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return mapCategory(data);
}

export async function setCategoryActive(categoryId: string, active: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    const existing = demoCategories.find((category) => category.id === categoryId);
    if (!existing) throw new Error("Category not found.");
    existing.active = active;
    return;
  }

  const { error } = await requireSupabaseClient().from("catalog_categories").update({ active }).eq("id", categoryId);
  if (error) throw error;
}

export async function removeCategory(categoryId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    demoCategories = demoCategories.filter((category) => category.id !== categoryId);
    return;
  }

  const { error } = await requireSupabaseClient().from("catalog_categories").delete().eq("id", categoryId);
  if (error) throw error;
}

export async function listCatalogItems(activeOnly = false): Promise<CatalogItem[]> {
  if (!isSupabaseConfigured) {
    return demoItems.filter((item) => !activeOnly || item.active);
  }

  let query = requireSupabaseClient().from("catalog_items").select("*").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapItem);
}

export async function listCatalogItemsForScope(
  scope: "lab" | "store",
  activeOnly = true,
  kinds?: CatalogItemKind[],
): Promise<CatalogItem[]> {
  const items = await listCatalogItems(activeOnly);
  return items.filter((item) => itemMatchesScope(item, scope) && (!kinds || kinds.includes(item.itemKind)));
}

export async function saveCatalogItem(input: CatalogItemInput, itemId?: string): Promise<CatalogItem> {
  if (!input.itemKey || !input.name || !input.unit) {
    throw new Error("Item key, name, and unit are required.");
  }

  if (!isSupabaseConfigured) {
    if (itemId) {
      const existing = demoItems.find((item) => item.id === itemId);
      if (!existing) throw new Error("Catalog item not found.");
      Object.assign(existing, input);
      return { ...existing };
    }

    const created = { id: makeId("item"), active: true, ...input };
    demoItems.push(created);
    return created;
  }

  const payload = {
    item_key: input.itemKey,
    category_id: input.categoryId,
    name: input.name,
    item_kind: input.itemKind,
    scope: input.scope,
    unit: input.unit,
    default_min_qty: input.defaultMinQty,
    track_inventory: input.trackInventory,
  };
  const query = itemId
    ? requireSupabaseClient().from("catalog_items").update(payload).eq("id", itemId).select().single()
    : requireSupabaseClient().from("catalog_items").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return mapItem(data);
}

export async function setCatalogItemActive(itemId: string, active: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    const existing = demoItems.find((item) => item.id === itemId);
    if (!existing) throw new Error("Catalog item not found.");
    existing.active = active;
    return;
  }

  const { error } = await requireSupabaseClient().from("catalog_items").update({ active }).eq("id", itemId);
  if (error) throw error;
}

export async function removeCatalogItem(itemId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    demoItems = demoItems.filter((item) => item.id !== itemId);
    return;
  }

  const { error } = await requireSupabaseClient().from("catalog_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function listProducts(activeOnly = false): Promise<Product[]> {
  if (!isSupabaseConfigured) {
    return demoProducts.filter((product) => !activeOnly || product.active);
  }

  let query = requireSupabaseClient().from("products").select("*").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapProduct);
}

export async function saveProduct(input: ProductInput, productId?: string): Promise<Product> {
  if (!input.productKey || !input.name) {
    throw new Error("Product key and name are required.");
  }

  if (!isSupabaseConfigured) {
    if (productId) {
      const existing = demoProducts.find((product) => product.id === productId);
      if (!existing) throw new Error("Product not found.");
      Object.assign(existing, input);
      return { ...existing };
    }

    const created = { id: makeId("product"), active: true, ...input };
    demoProducts.push(created);
    return created;
  }

  const payload = {
    product_key: input.productKey,
    name: input.name,
    catalog_item_id: input.catalogItemId,
    flavour_id: input.flavourId,
    scope: input.scope,
    track_inventory: input.trackInventory,
  };
  const query = productId
    ? requireSupabaseClient().from("products").update(payload).eq("id", productId).select().single()
    : requireSupabaseClient().from("products").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return mapProduct(data);
}

export async function setProductActive(productId: string, active: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    const existing = demoProducts.find((product) => product.id === productId);
    if (!existing) throw new Error("Product not found.");
    existing.active = active;
    return;
  }

  const { error } = await requireSupabaseClient().from("products").update({ active }).eq("id", productId);
  if (error) throw error;
}

export async function removeProduct(productId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    demoProducts = demoProducts.filter((product) => product.id !== productId);
    return;
  }

  const { error } = await requireSupabaseClient().from("products").delete().eq("id", productId);
  if (error) throw error;
}
