import type { CatalogItem, CatalogItemKind } from "../../domain/catalog";
import type {
  InventoryBalance,
  InventoryChecklistItem,
  InventoryCount,
  InventoryCountItem,
  InventoryCountWithItems,
  InventoryScope,
} from "../../domain/supplies";
import { isLabRole, isStoreRole, type AppRole } from "../../domain/roles";
import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import { listCatalogItemsForScope } from "../catalog/catalogApi";

export interface InventoryActor {
  actorId: string | null;
  actorRole: AppRole;
  actorLocationId: string | null;
}

export interface InventoryCountInput extends InventoryActor {
  locationId: string;
  businessDate: string;
  scope: InventoryScope;
  notes: string | null;
  items: Array<{
    catalogItemId: string;
    quantity: number;
    notes?: string | null;
  }>;
}

let demoInventoryCounts: InventoryCount[] = [];
let demoInventoryCountItems: InventoryCountItem[] = [];
let demoInventoryBalances: InventoryBalance[] = [];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapCount(row: Record<string, unknown>, scope: InventoryScope): InventoryCount {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    businessDate: String(row.business_date),
    scope,
    status: row.status === "corrected" ? "corrected" : "submitted",
    submittedBy: row.submitted_by ? String(row.submitted_by) : null,
    submittedAt: String(row.submitted_at),
    correctedBy: row.corrected_by ? String(row.corrected_by) : null,
    correctedAt: row.corrected_at ? String(row.corrected_at) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

function mapCountItem(row: Record<string, unknown>): InventoryCountItem {
  const catalogItem = Array.isArray(row.catalog_items) ? row.catalog_items[0] : row.catalog_items;

  return {
    id: String(row.id),
    countId: String(row.count_id),
    catalogItemId: String(row.catalog_item_id),
    itemName:
      catalogItem && typeof catalogItem === "object" && "name" in catalogItem
        ? String(catalogItem.name)
        : String(row.catalog_item_id),
    quantity: Number(row.quantity ?? 0),
    unit: String(row.unit ?? ""),
    notes: row.notes ? String(row.notes) : null,
  };
}

export function resetDemoInventoryData() {
  demoInventoryCounts = [];
  demoInventoryCountItems = [];
  demoInventoryBalances = [];
}

export async function listInventoryChecklist(
  scope: InventoryScope,
  kinds?: CatalogItemKind[],
): Promise<InventoryChecklistItem[]> {
  const items = await listCatalogItemsForScope(scope, true, kinds);
  return items
    .filter((item) => item.trackInventory)
    .map((catalogItem) => ({
      catalogItem,
      unit: catalogItem.unit,
      defaultMinQty: catalogItem.defaultMinQty,
    }));
}

function assertScopeAccess(actor: InventoryActor, locationId: string, scope: InventoryScope) {
  if (actor.actorRole === "admin") {
    return;
  }

  if (scope === "store" && !isStoreRole(actor.actorRole)) {
    throw new Error("Only store roles can submit store inventory.");
  }

  if (scope === "lab" && !isLabRole(actor.actorRole)) {
    throw new Error("Only lab roles can submit lab inventory.");
  }

  if (!actor.actorLocationId || actor.actorLocationId !== locationId) {
    throw new Error("Users can only count inventory for their assigned location.");
  }
}

function assertCanCorrect(actor: InventoryActor, businessDate: string) {
  if (actor.actorRole === "admin") {
    return;
  }

  if ((actor.actorRole === "store_manager" || actor.actorRole === "lab_manager") && businessDate === todayDate()) {
    return;
  }

  throw new Error("Only managers or Admin can correct inventory counts.");
}

function assertValidQuantities(input: InventoryCountInput) {
  const invalid = input.items.some((item) => !Number.isFinite(item.quantity) || item.quantity < 0);
  if (invalid) {
    throw new Error("Inventory quantities must be zero or more.");
  }
}

async function assertCatalogItemsAreAllowed(input: InventoryCountInput): Promise<CatalogItem[]> {
  const checklist = await listInventoryChecklist(input.scope);
  const allowedIds = new Set(checklist.map((item) => item.catalogItem.id));
  const invalid = input.items.some((item) => !allowedIds.has(item.catalogItemId));
  if (invalid) {
    throw new Error("Inventory counts can only use active Admin catalog items.");
  }
  return checklist.map((item) => item.catalogItem);
}

export async function submitInventoryCount(input: InventoryCountInput): Promise<InventoryCountWithItems> {
  assertScopeAccess(input, input.locationId, input.scope);
  assertValidQuantities(input);
  const catalogItems = await assertCatalogItemsAreAllowed(input);

  if (!isSupabaseConfigured) {
    return submitDemoInventoryCount(input, catalogItems);
  }

  return submitSupabaseInventoryCount(input, catalogItems);
}

async function submitDemoInventoryCount(
  input: InventoryCountInput,
  catalogItems: CatalogItem[],
): Promise<InventoryCountWithItems> {
  const existing = demoInventoryCounts.find(
    (count) =>
      count.locationId === input.locationId && count.businessDate === input.businessDate && count.scope === input.scope,
  );
  if (existing) {
    assertCanCorrect(input, input.businessDate);
  }

  const count: InventoryCount = existing
    ? {
        ...existing,
        status: "corrected",
        correctedBy: input.actorId,
        correctedAt: new Date().toISOString(),
        notes: input.notes,
      }
    : {
        id: makeId("inventory-count"),
        locationId: input.locationId,
        businessDate: input.businessDate,
        scope: input.scope,
        status: "submitted",
        submittedBy: input.actorId,
        submittedAt: new Date().toISOString(),
        correctedBy: null,
        correctedAt: null,
        notes: input.notes,
      };

  if (existing) {
    Object.assign(existing, count);
  } else {
    demoInventoryCounts.push(count);
  }

  const submittedIds = new Set(input.items.map((item) => item.catalogItemId));
  demoInventoryCountItems = demoInventoryCountItems.filter(
    (item) => item.countId !== count.id || !submittedIds.has(item.catalogItemId),
  );

  const items = input.items.map((item): InventoryCountItem => {
    const catalogItem = catalogItems.find((candidate) => candidate.id === item.catalogItemId);
    return {
      id: makeId("inventory-count-item"),
      countId: count.id,
      catalogItemId: item.catalogItemId,
      itemName: catalogItem?.name ?? item.catalogItemId,
      quantity: item.quantity,
      unit: catalogItem?.unit ?? "",
      notes: item.notes ?? null,
    };
  });
  demoInventoryCountItems.push(...items);
  upsertDemoBalances(input.locationId, input.items, catalogItems);
  return { ...count, items: demoInventoryCountItems.filter((item) => item.countId === count.id) };
}

function upsertDemoBalances(
  locationId: string,
  items: InventoryCountInput["items"],
  catalogItems: CatalogItem[],
) {
  items.forEach((item) => {
    const catalogItem = catalogItems.find((candidate) => candidate.id === item.catalogItemId);
    const existing = demoInventoryBalances.find(
      (balance) => balance.locationId === locationId && balance.catalogItemId === item.catalogItemId,
    );
    const balance: InventoryBalance = {
      id: existing?.id ?? makeId("inventory-balance"),
      locationId,
      catalogItemId: item.catalogItemId,
      quantity: item.quantity,
      minQty: catalogItem?.defaultMinQty ?? 0,
      updatedAt: new Date().toISOString(),
    };
    if (existing) {
      Object.assign(existing, balance);
    } else {
      demoInventoryBalances.push(balance);
    }
  });
}

async function submitSupabaseInventoryCount(
  input: InventoryCountInput,
  catalogItems: CatalogItem[],
): Promise<InventoryCountWithItems> {
  const supabase = requireSupabaseClient();
  const existing = await findSupabaseCount(input.locationId, input.businessDate, input.scope);
  const submittedIds = input.items.map((item) => item.catalogItemId);
  const existingItems = existing
    ? (await listSupabaseCountItems(existing.id)).filter((item) => submittedIds.includes(item.catalogItemId))
    : [];

  if (existingItems.length > 0) {
    assertCanCorrect(input, input.businessDate);
  }

  const count = existing
    ? await updateSupabaseCount(existing.id, input, existingItems.length > 0)
    : await createSupabaseCount(input);

  if (submittedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("end_of_day_count_items")
      .delete()
      .eq("count_id", count.id)
      .in("catalog_item_id", submittedIds);
    if (deleteError) throw deleteError;
  }

  const { data, error } = input.items.length
    ? await supabase
        .from("end_of_day_count_items")
        .insert(
          input.items.map((item) => {
            const catalogItem = catalogItems.find((candidate) => candidate.id === item.catalogItemId);
            return {
              count_id: count.id,
              catalog_item_id: item.catalogItemId,
              quantity: item.quantity,
              unit: catalogItem?.unit ?? "",
              notes: item.notes ?? null,
            };
          }),
        )
        .select("*, catalog_items(name)")
    : { data: [], error: null };

  if (error) throw error;

  if (input.items.length > 0) {
    const { error: balanceError } = await supabase.from("inventory_balances").upsert(
      input.items.map((item) => {
        const catalogItem = catalogItems.find((candidate) => candidate.id === item.catalogItemId);
        return {
          location_id: input.locationId,
          catalog_item_id: item.catalogItemId,
          quantity: item.quantity,
          min_qty: catalogItem?.defaultMinQty ?? 0,
        };
      }),
      { onConflict: "location_id,catalog_item_id" },
    );

    if (balanceError) throw balanceError;
  }

  return { ...count, items: data.map(mapCountItem) };
}

async function findSupabaseCount(
  locationId: string,
  businessDate: string,
  scope: InventoryScope,
): Promise<InventoryCount | null> {
  const { data, error } = await requireSupabaseClient()
    .from("end_of_day_counts")
    .select("*")
    .eq("location_id", locationId)
    .eq("business_date", businessDate)
    .limit(1);

  if (error) throw error;
  return data[0] ? mapCount(data[0], scope) : null;
}

async function createSupabaseCount(input: InventoryCountInput): Promise<InventoryCount> {
  const { data, error } = await requireSupabaseClient()
    .from("end_of_day_counts")
    .insert({
      location_id: input.locationId,
      business_date: input.businessDate,
      status: "submitted",
      submitted_by: input.actorId,
      notes: input.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return mapCount(data, input.scope);
}

async function updateSupabaseCount(
  countId: string,
  input: InventoryCountInput,
  correction: boolean,
): Promise<InventoryCount> {
  if (!correction) {
    const existing = await findSupabaseCount(input.locationId, input.businessDate, input.scope);
    if (!existing) throw new Error("Inventory count not found.");
    return existing;
  }

  const { data, error } = await requireSupabaseClient()
    .from("end_of_day_counts")
    .update({
      status: "corrected",
      corrected_by: input.actorId,
      corrected_at: new Date().toISOString(),
      notes: input.notes,
    })
    .eq("id", countId)
    .select()
    .single();

  if (error) throw error;
  return mapCount(data, input.scope);
}

async function listSupabaseCountItems(countId: string): Promise<InventoryCountItem[]> {
  const { data, error } = await requireSupabaseClient()
    .from("end_of_day_count_items")
    .select("*, catalog_items(name)")
    .eq("count_id", countId)
    .not("catalog_item_id", "is", null);

  if (error) throw error;
  return data.map(mapCountItem);
}

export async function listInventoryCounts(scope?: InventoryScope): Promise<InventoryCountWithItems[]> {
  if (!isSupabaseConfigured) {
    return demoInventoryCounts
      .filter((count) => !scope || count.scope === scope)
      .map((count) => ({
        ...count,
        items: demoInventoryCountItems.filter((item) => item.countId === count.id),
      }));
  }

  const { data, error } = await requireSupabaseClient()
    .from("end_of_day_counts")
    .select("*")
    .order("business_date", { ascending: false });

  if (error) throw error;

  return Promise.all(
    data.map(async (row) => {
      const count = mapCount(row, scope ?? "store");
      return { ...count, items: await listSupabaseCountItems(count.id) };
    }),
  );
}
