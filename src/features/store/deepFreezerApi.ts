import type {
  DeepFreezerCount,
  DeepFreezerCountItem,
  DeepFreezerCountWithItems,
  StoreFlavourTarget,
  StoreGelatoRequirement,
} from "../../domain/inventory";
import { isStoreRole, type AppRole } from "../../domain/roles";
import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import { listLocations } from "../admin/staff/staffApi";
import { listFlavours } from "../catalog/catalogApi";
import type { StoreActor } from "./storeApi";

export interface DeepFreezerCountInput extends StoreActor {
  locationId: string;
  businessDate: string;
  notes: string | null;
  items: Array<{
    flavourId: string;
    weightKg: number;
    notes?: string | null;
  }>;
}

export interface StoreFlavourTargetInput {
  locationId: string;
  flavourId: string;
  targetWeightKg: number;
  actorRole: AppRole;
}

let demoDeepFreezerCounts: DeepFreezerCount[] = [];
let demoDeepFreezerItems: DeepFreezerCountItem[] = [];
let demoStoreTargets: StoreFlavourTarget[] = [];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapCount(row: Record<string, unknown>): DeepFreezerCount {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    businessDate: String(row.business_date),
    status: row.status as DeepFreezerCount["status"],
    submittedBy: row.submitted_by ? String(row.submitted_by) : null,
    submittedAt: String(row.submitted_at),
    correctedBy: row.corrected_by ? String(row.corrected_by) : null,
    correctedAt: row.corrected_at ? String(row.corrected_at) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

function mapItem(row: Record<string, unknown>): DeepFreezerCountItem {
  const flavour = Array.isArray(row.flavours) ? row.flavours[0] : row.flavours;

  return {
    id: String(row.id),
    countId: String(row.count_id),
    flavourId: String(row.flavour_id),
    flavourName:
      flavour && typeof flavour === "object" && "name" in flavour ? String(flavour.name) : String(row.flavour_id),
    weightKg: Number(row.weight_kg ?? 0),
    unit: "kg",
    notes: row.notes ? String(row.notes) : null,
  };
}

function mapTarget(row: Record<string, unknown>): StoreFlavourTarget {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    flavourId: String(row.flavour_id),
    targetWeightKg: Number(row.target_weight_kg ?? 0),
    active: Boolean(row.active),
  };
}

export function resetDemoDeepFreezerData() {
  demoDeepFreezerCounts = [];
  demoDeepFreezerItems = [];
  demoStoreTargets = [];
}

function assertStoreCountAccess(actor: StoreActor, locationId: string) {
  if (actor.actorRole === "admin") {
    return;
  }

  if (!isStoreRole(actor.actorRole)) {
    throw new Error("Only store roles can submit deep freezer counts.");
  }

  if (!actor.actorLocationId || actor.actorLocationId !== locationId) {
    throw new Error("Store users can only count deep freezer inventory for their active store.");
  }
}

function assertCanCorrect(actor: StoreActor, businessDate: string) {
  if (actor.actorRole === "admin") {
    return;
  }

  if (actor.actorRole === "store_manager" && businessDate === todayDate()) {
    return;
  }

  throw new Error("Only Store Manager or Admin can correct deep freezer counts.");
}

function assertValidWeights(items: DeepFreezerCountInput["items"]) {
  const invalid = items.some((item) => !Number.isFinite(item.weightKg) || item.weightKg < 0);
  if (invalid) {
    throw new Error("Deep freezer weights must be zero or more kg.");
  }
}

async function assertActiveFlavours(items: DeepFreezerCountInput["items"]) {
  const activeFlavourIds = new Set((await listFlavours(true)).map((flavour) => flavour.id));
  const invalid = items.some((item) => !activeFlavourIds.has(item.flavourId));
  if (invalid) {
    throw new Error("Deep freezer counts can only use active flavours.");
  }
}

export async function submitDeepFreezerCount(input: DeepFreezerCountInput): Promise<DeepFreezerCountWithItems> {
  assertStoreCountAccess(input, input.locationId);
  assertValidWeights(input.items);
  await assertActiveFlavours(input.items);

  const existing = await getDeepFreezerCount(input.locationId, input.businessDate);
  if (existing) {
    assertCanCorrect(input, input.businessDate);
  }

  if (!isSupabaseConfigured) {
    return submitDemoCount(input, existing);
  }

  return submitSupabaseCount(input, existing);
}

async function submitDemoCount(
  input: DeepFreezerCountInput,
  existing: DeepFreezerCountWithItems | null,
): Promise<DeepFreezerCountWithItems> {
  const count: DeepFreezerCount = existing
    ? {
        ...existing,
        status: "corrected",
        correctedBy: input.actorId,
        correctedAt: new Date().toISOString(),
        notes: input.notes,
      }
    : {
        id: makeId("freezer-count"),
        locationId: input.locationId,
        businessDate: input.businessDate,
        status: "submitted",
        submittedBy: input.actorId,
        submittedAt: new Date().toISOString(),
        correctedBy: null,
        correctedAt: null,
        notes: input.notes,
      };

  if (existing) {
    const index = demoDeepFreezerCounts.findIndex((item) => item.id === existing.id);
    demoDeepFreezerCounts[index] = count;
  } else {
    demoDeepFreezerCounts.push(count);
  }

  const flavourById = new Map((await listFlavours(true)).map((flavour) => [flavour.id, flavour]));
  demoDeepFreezerItems = demoDeepFreezerItems.filter((item) => item.countId !== count.id);
  const items = input.items.map((item): DeepFreezerCountItem => ({
    id: makeId("freezer-item"),
    countId: count.id,
    flavourId: item.flavourId,
    flavourName: flavourById.get(item.flavourId)?.name ?? item.flavourId,
    weightKg: item.weightKg,
    unit: "kg",
    notes: item.notes ?? null,
  }));
  demoDeepFreezerItems.push(...items);

  return { ...count, items };
}

async function submitSupabaseCount(
  input: DeepFreezerCountInput,
  existing: DeepFreezerCountWithItems | null,
): Promise<DeepFreezerCountWithItems> {
  const supabase = requireSupabaseClient();
  const count = existing
    ? await updateSupabaseCount(existing.id, input)
    : await createSupabaseCount(input);

  const { error: deleteError } = await supabase
    .from("store_deep_freezer_count_items")
    .delete()
    .eq("count_id", count.id);
  if (deleteError) throw deleteError;

  const { data, error } = input.items.length
    ? await supabase
        .from("store_deep_freezer_count_items")
        .insert(
          input.items.map((item) => ({
            count_id: count.id,
            flavour_id: item.flavourId,
            weight_kg: item.weightKg,
            unit: "kg",
            notes: item.notes ?? null,
          })),
        )
        .select("*, flavours(name)")
    : { data: [], error: null };

  if (error) throw error;
  return { ...count, items: data.map(mapItem) };
}

async function createSupabaseCount(input: DeepFreezerCountInput): Promise<DeepFreezerCount> {
  const { data, error } = await requireSupabaseClient()
    .from("store_deep_freezer_counts")
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
  return mapCount(data);
}

async function updateSupabaseCount(countId: string, input: DeepFreezerCountInput): Promise<DeepFreezerCount> {
  const { data, error } = await requireSupabaseClient()
    .from("store_deep_freezer_counts")
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
  return mapCount(data);
}

export async function getDeepFreezerCount(
  locationId: string,
  businessDate: string,
): Promise<DeepFreezerCountWithItems | null> {
  if (!isSupabaseConfigured) {
    const count = demoDeepFreezerCounts.find(
      (item) => item.locationId === locationId && item.businessDate === businessDate,
    );
    return count ? { ...count, items: demoDeepFreezerItems.filter((item) => item.countId === count.id) } : null;
  }

  const { data, error } = await requireSupabaseClient()
    .from("store_deep_freezer_counts")
    .select("*")
    .eq("location_id", locationId)
    .eq("business_date", businessDate)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { ...mapCount(data), items: await listSupabaseItems(String(data.id)) };
}

async function listSupabaseItems(countId: string): Promise<DeepFreezerCountItem[]> {
  const { data, error } = await requireSupabaseClient()
    .from("store_deep_freezer_count_items")
    .select("*, flavours(name)")
    .eq("count_id", countId)
    .order("flavour_id");

  if (error) throw error;
  return data.map(mapItem);
}

export async function listDeepFreezerCounts(): Promise<DeepFreezerCountWithItems[]> {
  if (!isSupabaseConfigured) {
    return demoDeepFreezerCounts.map((count) => ({
      ...count,
      items: demoDeepFreezerItems.filter((item) => item.countId === count.id),
    }));
  }

  const { data, error } = await requireSupabaseClient()
    .from("store_deep_freezer_counts")
    .select("*")
    .order("business_date", { ascending: false });

  if (error) throw error;
  return Promise.all(data.map(async (row) => ({ ...mapCount(row), items: await listSupabaseItems(String(row.id)) })));
}

export async function getLatestDeepFreezerCount(locationId: string): Promise<DeepFreezerCountWithItems | null> {
  const counts = await listDeepFreezerCounts();
  return (
    counts
      .filter((count) => count.locationId === locationId)
      .sort((a, b) => `${b.businessDate}-${b.submittedAt}`.localeCompare(`${a.businessDate}-${a.submittedAt}`))[0] ?? null
  );
}

export async function listStoreFlavourTargets(locationId?: string): Promise<StoreFlavourTarget[]> {
  if (!isSupabaseConfigured) {
    return demoStoreTargets.filter((target) => target.active && (!locationId || target.locationId === locationId));
  }

  let query = requireSupabaseClient().from("store_flavour_targets").select("*").eq("active", true);
  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapTarget);
}

export async function saveStoreFlavourTarget(input: StoreFlavourTargetInput): Promise<StoreFlavourTarget> {
  if (input.actorRole !== "admin") {
    throw new Error("Only Admin can manage store flavour targets.");
  }

  if (!Number.isFinite(input.targetWeightKg) || input.targetWeightKg < 0) {
    throw new Error("Target weight must be zero or more kg.");
  }

  if (!isSupabaseConfigured) {
    const existing = demoStoreTargets.find(
      (target) => target.locationId === input.locationId && target.flavourId === input.flavourId,
    );
    const target: StoreFlavourTarget = {
      id: existing?.id ?? makeId("target"),
      locationId: input.locationId,
      flavourId: input.flavourId,
      targetWeightKg: input.targetWeightKg,
      active: true,
    };
    if (existing) {
      Object.assign(existing, target);
    } else {
      demoStoreTargets.push(target);
    }
    return target;
  }

  const { data, error } = await requireSupabaseClient()
    .from("store_flavour_targets")
    .upsert(
      {
        location_id: input.locationId,
        flavour_id: input.flavourId,
        target_weight_kg: input.targetWeightKg,
        active: true,
      },
      { onConflict: "location_id,flavour_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return mapTarget(data);
}

export async function listStoreGelatoRequirements(): Promise<StoreGelatoRequirement[]> {
  const [locations, flavours, targets, counts] = await Promise.all([
    listLocations(),
    listFlavours(true),
    listStoreFlavourTargets(),
    listDeepFreezerCounts(),
  ]);
  const stores = locations.filter((location) => location.type === "store");
  const flavourById = new Map(flavours.map((flavour) => [flavour.id, flavour]));
  const storeById = new Map(stores.map((store) => [store.id, store]));
  const latestByStore = new Map<string, DeepFreezerCountWithItems>();

  stores.forEach((store) => {
    const latest = counts
      .filter((count) => count.locationId === store.id)
      .sort((a, b) => `${b.businessDate}-${b.submittedAt}`.localeCompare(`${a.businessDate}-${a.submittedAt}`))[0];
    if (latest) latestByStore.set(store.id, latest);
  });

  return targets
    .map((target): StoreGelatoRequirement | null => {
      const store = storeById.get(target.locationId);
      const flavour = flavourById.get(target.flavourId);
      if (!store || !flavour || target.targetWeightKg <= 0) return null;

      const currentWeightKg =
        latestByStore.get(target.locationId)?.items.find((item) => item.flavourId === target.flavourId)?.weightKg ?? 0;
      const neededWeightKg = Math.max(0, target.targetWeightKg - currentWeightKg);
      if (neededWeightKg <= 0) return null;

      return {
        id: `${target.locationId}:${target.flavourId}`,
        locationId: target.locationId,
        locationName: store.name,
        flavourId: target.flavourId,
        flavourName: flavour.name,
        currentWeightKg,
        targetWeightKg: target.targetWeightKg,
        neededWeightKg,
      };
    })
    .filter((item): item is StoreGelatoRequirement => item !== null)
    .sort((a, b) => a.locationName.localeCompare(b.locationName) || b.neededWeightKg - a.neededWeightKg);
}
