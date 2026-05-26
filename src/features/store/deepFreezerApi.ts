import type {
  DeepFreezerBalance,
  DeepFreezerCount,
  DeepFreezerCountItem,
  DeepFreezerCountType,
  DeepFreezerCountWithItems,
  StoreFlavourTarget,
  StoreGelatoRequirement,
} from "../../domain/inventory";
import { isStoreRole, type AppRole } from "../../domain/roles";
import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import { listLocations } from "../admin/staff/staffApi";
import { listFlavours } from "../catalog/catalogApi";
import { listDispatchItems, listPansByIds } from "../lab/labApi";
import { listDisplayMovements, listPanEvents, listStoreReceipts, type StoreActor } from "./storeApi";

export interface DeepFreezerCountInput extends StoreActor {
  locationId: string;
  businessDate: string;
  countType?: DeepFreezerCountType;
  notes: string | null;
  items: Array<{
    flavourId: string;
    weightKg: number;
    notes?: string | null;
  }>;
}

type PreparedDeepFreezerCountInput = Omit<DeepFreezerCountInput, "items"> & {
  countType: DeepFreezerCountType;
  items: Array<{
    flavourId: string;
    weightKg: number;
    expectedWeightKg: number | null;
    varianceKg: number | null;
    notes?: string | null;
  }>;
};

export interface StoreFlavourTargetInput {
  locationId: string;
  flavourId: string;
  targetWeightKg: number;
  actorRole: AppRole;
}

export const MORNING_VERIFICATION_TOLERANCE_KG = 0.05;

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
    countType: (row.count_type as DeepFreezerCountType | undefined) ?? "eod",
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
    expectedWeightKg: row.expected_weight_kg == null ? null : Number(row.expected_weight_kg),
    varianceKg: row.variance_kg == null ? null : Number(row.variance_kg),
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

function roundWeightKg(value: number): number {
  return Number(Math.max(0, value).toFixed(3));
}

function roundVarianceKg(value: number): number {
  return Number(value.toFixed(3));
}

function getCountType(input: Pick<DeepFreezerCountInput, "countType">): DeepFreezerCountType {
  return input.countType ?? "eod";
}

function addWeight(weights: Map<string, number>, flavourId: string, weightKg: number) {
  weights.set(flavourId, (weights.get(flavourId) ?? 0) + weightKg);
}

function baselineCutoffMs(count: DeepFreezerCountWithItems | null): number {
  if (!count) {
    return 0;
  }

  return new Date(`${count.businessDate}T23:59:59.999Z`).getTime();
}

function happenedAfterBaseline(timestamp: string, baselineMs: number): boolean {
  return new Date(timestamp).getTime() > baselineMs;
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

  const preparedInput = await prepareCountInput(input);
  const existing = await getDeepFreezerCount(input.locationId, input.businessDate, preparedInput.countType);
  if (existing) {
    assertCanCorrect(input, input.businessDate);
  }

  if (!isSupabaseConfigured) {
    return submitDemoCount(preparedInput, existing);
  }

  return submitSupabaseCount(preparedInput, existing);
}

async function prepareCountInput(input: DeepFreezerCountInput): Promise<PreparedDeepFreezerCountInput> {
  const countType = getCountType(input);
  if (countType !== "morning") {
    return {
      ...input,
      countType,
      items: input.items.map((item) => ({ ...item, expectedWeightKg: null, varianceKg: null })),
    };
  }

  const expectedByFlavour = new Map(
    (await listProjectedDeepFreezerBalances(input.locationId)).map((balance) => [
      balance.flavourId,
      balance.currentWeightKg,
    ]),
  );

  return {
    ...input,
    countType,
    items: input.items.map((item) => {
      const expectedWeightKg = roundWeightKg(expectedByFlavour.get(item.flavourId) ?? 0);
      return {
        ...item,
        expectedWeightKg,
        varianceKg: roundVarianceKg(item.weightKg - expectedWeightKg),
      };
    }),
  };
}

async function submitDemoCount(
  input: PreparedDeepFreezerCountInput,
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
        countType: input.countType,
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
    expectedWeightKg: item.expectedWeightKg,
    varianceKg: item.varianceKg,
    notes: item.notes ?? null,
  }));
  demoDeepFreezerItems.push(...items);

  return { ...count, items };
}

async function submitSupabaseCount(
  input: PreparedDeepFreezerCountInput,
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
            expected_weight_kg: item.expectedWeightKg,
            variance_kg: item.varianceKg,
            notes: item.notes ?? null,
          })),
        )
        .select("*, flavours(name)")
    : { data: [], error: null };

  if (error) throw error;
  return { ...count, items: data.map(mapItem) };
}

async function createSupabaseCount(input: PreparedDeepFreezerCountInput): Promise<DeepFreezerCount> {
  const { data, error } = await requireSupabaseClient()
    .from("store_deep_freezer_counts")
    .insert({
      location_id: input.locationId,
      business_date: input.businessDate,
      count_type: input.countType,
      status: "submitted",
      submitted_by: input.actorId,
      notes: input.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return mapCount(data);
}

async function updateSupabaseCount(countId: string, input: PreparedDeepFreezerCountInput): Promise<DeepFreezerCount> {
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
  countType: DeepFreezerCountType = "eod",
): Promise<DeepFreezerCountWithItems | null> {
  if (!isSupabaseConfigured) {
    const count = demoDeepFreezerCounts.find(
      (item) => item.locationId === locationId && item.businessDate === businessDate && item.countType === countType,
    );
    return count ? { ...count, items: demoDeepFreezerItems.filter((item) => item.countId === count.id) } : null;
  }

  const { data, error } = await requireSupabaseClient()
    .from("store_deep_freezer_counts")
    .select("*")
    .eq("location_id", locationId)
    .eq("business_date", businessDate)
    .eq("count_type", countType)
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

export async function listDeepFreezerCounts(
  countType?: DeepFreezerCountType,
): Promise<DeepFreezerCountWithItems[]> {
  if (!isSupabaseConfigured) {
    return demoDeepFreezerCounts
      .filter((count) => !countType || count.countType === countType)
      .map((count) => ({
        ...count,
        items: demoDeepFreezerItems.filter((item) => item.countId === count.id),
      }));
  }

  let query = requireSupabaseClient()
    .from("store_deep_freezer_counts")
    .select("*")
    .order("business_date", { ascending: false })
    .order("submitted_at", { ascending: false });

  if (countType) {
    query = query.eq("count_type", countType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return Promise.all(data.map(async (row) => ({ ...mapCount(row), items: await listSupabaseItems(String(row.id)) })));
}

export async function getLatestDeepFreezerCount(
  locationId: string,
  countType: DeepFreezerCountType = "eod",
): Promise<DeepFreezerCountWithItems | null> {
  const counts = await listDeepFreezerCounts(countType);
  return (
    counts
      .filter((count) => count.locationId === locationId)
      .sort((a, b) => `${b.businessDate}-${b.submittedAt}`.localeCompare(`${a.businessDate}-${a.submittedAt}`))[0] ?? null
  );
}

async function listReceivedWeightsByFlavour(locationId: string, baselineMs: number): Promise<Map<string, number>> {
  const receivedWeights = new Map<string, number>();
  const receipts = (await listStoreReceipts(locationId)).filter(
    (receipt) => receipt.status === "accepted" && happenedAfterBaseline(receipt.receivedAt, baselineMs),
  );

  await Promise.all(
    receipts.map(async (receipt) => {
      const items = await listDispatchItems(receipt.dispatchId);
      const pans = await listPansByIds(items.map((item) => item.panId));
      const panById = new Map(pans.map((pan) => [pan.id, pan]));

      items.forEach((item) => {
        const pan = panById.get(item.panId);
        if (!pan) return;

        addWeight(receivedWeights, pan.flavourId, item.plannedWeightKg ?? pan.fullWeightKg ?? pan.currentWeightKg ?? 0);
      });
    }),
  );

  return receivedWeights;
}

async function listDisplayMovedWeightsByFlavour(locationId: string, baselineMs: number): Promise<Map<string, number>> {
  const displayMovedWeights = new Map<string, number>();
  const movements = (await listDisplayMovements(locationId)).filter((movement) =>
    happenedAfterBaseline(movement.movedAt, baselineMs),
  );
  const pans = await listPansByIds([...new Set(movements.map((movement) => movement.panId))]);
  const panById = new Map(pans.map((pan) => [pan.id, pan]));

  movements.forEach((movement) => {
    const pan = panById.get(movement.panId);
    if (!pan) return;

    addWeight(displayMovedWeights, pan.flavourId, movement.weightKg ?? 0);
  });

  return displayMovedWeights;
}

async function listDisplayReturnedWeightsByFlavour(locationId: string, baselineMs: number): Promise<Map<string, number>> {
  const returnedWeights = new Map<string, number>();
  const events = (await listPanEvents(locationId)).filter(
    (event) => event.eventType === "display_pan_returned_to_backup" && happenedAfterBaseline(event.recordedAt, baselineMs),
  );
  const pans = await listPansByIds([...new Set(events.map((event) => event.panUuid))]);
  const panById = new Map(pans.map((pan) => [pan.id, pan]));

  events.forEach((event) => {
    const pan = panById.get(event.panUuid);
    if (!pan) return;

    addWeight(returnedWeights, pan.flavourId, event.weightKg ?? 0);
  });

  return returnedWeights;
}

export async function listProjectedDeepFreezerBalances(locationId: string): Promise<DeepFreezerBalance[]> {
  const [flavours, latestCount] = await Promise.all([listFlavours(true), getLatestDeepFreezerCount(locationId)]);
  const baselineMs = baselineCutoffMs(latestCount);
  const baseWeights = new Map(latestCount?.items.map((item) => [item.flavourId, item.weightKg]) ?? []);
  const [receivedWeights, displayMovedWeights, displayReturnedWeights] = await Promise.all([
    listReceivedWeightsByFlavour(locationId, baselineMs),
    listDisplayMovedWeightsByFlavour(locationId, baselineMs),
    listDisplayReturnedWeightsByFlavour(locationId, baselineMs),
  ]);

  return flavours
    .map((flavour): DeepFreezerBalance => {
      const baseWeightKg = baseWeights.get(flavour.id) ?? 0;
      const receivedWeightKg = receivedWeights.get(flavour.id) ?? 0;
      const displayMovedWeightKg = displayMovedWeights.get(flavour.id) ?? 0;
      const displayReturnedWeightKg = displayReturnedWeights.get(flavour.id) ?? 0;

      return {
        locationId,
        flavourId: flavour.id,
        flavourName: flavour.name,
        baseWeightKg,
        receivedWeightKg,
        displayMovedWeightKg,
        displayReturnedWeightKg,
        currentWeightKg: roundWeightKg(baseWeightKg + receivedWeightKg - displayMovedWeightKg + displayReturnedWeightKg),
        sourceCountId: latestCount?.id ?? null,
        sourceBusinessDate: latestCount?.businessDate ?? null,
      };
    })
    .sort((a, b) => a.flavourName.localeCompare(b.flavourName));
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
  const [locations, flavours, targets] = await Promise.all([
    listLocations(),
    listFlavours(true),
    listStoreFlavourTargets(),
  ]);
  const stores = locations.filter((location) => location.type === "store");
  const flavourById = new Map(flavours.map((flavour) => [flavour.id, flavour]));
  const storeById = new Map(stores.map((store) => [store.id, store]));
  const balancesByStore = new Map(
    await Promise.all(stores.map(async (store) => [store.id, await listProjectedDeepFreezerBalances(store.id)] as const)),
  );

  return targets
    .map((target): StoreGelatoRequirement | null => {
      const store = storeById.get(target.locationId);
      const flavour = flavourById.get(target.flavourId);
      if (!store || !flavour || target.targetWeightKg <= 0) return null;

      const currentWeightKg =
        balancesByStore.get(target.locationId)?.find((item) => item.flavourId === target.flavourId)?.currentWeightKg ?? 0;
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
