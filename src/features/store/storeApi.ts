import type { Dispatch } from "../../domain/dispatches";
import type { EodCount, EodCountItem, DisplayMovement, FillState, StoreReceipt } from "../../domain/inventory";
import type { Pan } from "../../domain/pans";
import { isStoreRole, type AppRole } from "../../domain/roles";
import { validateGelatoPanWeightKg } from "../../domain/weights";
import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import {
  listAllPans,
  listDispatchItems,
  listLabDispatches,
  listPansByIds,
  updateDispatchStatus,
  updatePanState,
} from "../lab/labApi";

export interface IncomingDispatch extends Dispatch {
  pans: Pan[];
}

export interface StoreActor {
  actorId: string | null;
  actorRole: AppRole;
  actorLocationId: string | null;
}

export interface AcceptDispatchInput extends StoreActor {
  dispatchId: string;
  locationId: string;
  notes: string | null;
}

export interface DisplayMovementInput extends StoreActor {
  panUuid: string;
  storeLocationId: string;
  fillState: FillState;
  weightKg: number | null;
}

export interface EodCountInput extends StoreActor {
  locationId: string;
  businessDate: string;
  notes: string | null;
  items: Array<{
    panUuid?: string | null;
    flavourId?: string | null;
    weightKg: number;
    notes?: string | null;
  }>;
}

export interface EodCountWithItems extends EodCount {
  items: EodCountItem[];
}

export interface EodGelatoCorrectionInput {
  countId: string;
  itemId: string;
  weightKg: number;
  correctedBy: string | null;
}

let demoReceipts: StoreReceipt[] = [];
let demoDisplayMovements: DisplayMovement[] = [];
let demoEodCounts: EodCount[] = [];
let demoEodCountItems: EodCountItem[] = [];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapReceipt(row: Record<string, unknown>): StoreReceipt {
  return {
    id: String(row.id),
    dispatchId: String(row.dispatch_id),
    locationId: String(row.location_id),
    status: row.status as StoreReceipt["status"],
    receivedBy: row.received_by ? String(row.received_by) : null,
    receivedAt: String(row.received_at),
    notes: row.notes ? String(row.notes) : null,
  };
}

function mapDisplayMovement(row: Record<string, unknown>): DisplayMovement {
  return {
    id: String(row.id),
    panId: String(row.pan_uuid),
    storeLocationId: String(row.store_location_id),
    fillState: row.fill_state as FillState,
    weightKg: row.weight_kg === null || row.weight_kg === undefined ? null : Number(row.weight_kg),
    movedBy: row.moved_by ? String(row.moved_by) : null,
    movedAt: String(row.moved_at),
  };
}

function mapEodCount(row: Record<string, unknown>): EodCount {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    businessDate: String(row.business_date),
    status: row.status as EodCount["status"],
    submittedBy: row.submitted_by ? String(row.submitted_by) : null,
    submittedAt: String(row.submitted_at),
    correctedBy: row.corrected_by ? String(row.corrected_by) : null,
    correctedAt: row.corrected_at ? String(row.corrected_at) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

function mapEodCountItem(row: Record<string, unknown>): EodCountItem {
  return {
    id: String(row.id),
    countId: String(row.count_id),
    panId: row.pan_uuid ? String(row.pan_uuid) : null,
    flavourId: row.flavour_id ? String(row.flavour_id) : null,
    catalogItemId: row.catalog_item_id ? String(row.catalog_item_id) : null,
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    weightKg: row.weight_kg === null || row.weight_kg === undefined ? null : Number(row.weight_kg),
    unit: row.unit ? String(row.unit) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

function isGelatoEodItem(item: EodCountItem): boolean {
  return item.panId !== null || item.flavourId !== null;
}

export function resetDemoStoreData() {
  demoReceipts = [];
  demoDisplayMovements = [];
  demoEodCounts = [];
  demoEodCountItems = [];
}

function assertStoreLocation(actor: StoreActor, locationId: string) {
  if (actor.actorRole !== "admin" && !isStoreRole(actor.actorRole)) {
    throw new Error("Only store roles can use store workflows.");
  }

  if (actor.actorRole === "admin") {
    return;
  }

  if (!actor.actorLocationId || actor.actorLocationId !== locationId) {
    throw new Error("Store users can only work in their assigned store.");
  }
}

function assertCanCorrectCount(actor: StoreActor, businessDate: string) {
  if (actor.actorRole === "admin") {
    return;
  }

  if (actor.actorRole === "store_manager" && businessDate === todayDate()) {
    return;
  }

  throw new Error("Only Store Manager or Admin can correct this count.");
}

async function createReceipt(input: AcceptDispatchInput): Promise<StoreReceipt> {
  if (!isSupabaseConfigured) {
    const receipt: StoreReceipt = {
      id: makeId("receipt"),
      dispatchId: input.dispatchId,
      locationId: input.locationId,
      status: "accepted",
      receivedBy: input.actorId,
      receivedAt: new Date().toISOString(),
      notes: input.notes,
    };
    demoReceipts.push(receipt);
    return receipt;
  }

  const { data, error } = await requireSupabaseClient()
    .from("store_receipts")
    .insert({
      dispatch_id: input.dispatchId,
      location_id: input.locationId,
      status: "accepted",
      received_by: input.actorId,
      notes: input.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return mapReceipt(data);
}

async function createDisplayMovement(input: DisplayMovementInput): Promise<DisplayMovement> {
  if (!isSupabaseConfigured) {
    const movement: DisplayMovement = {
      id: makeId("display-movement"),
      panId: input.panUuid,
      storeLocationId: input.storeLocationId,
      fillState: input.fillState,
      weightKg: input.weightKg,
      movedBy: input.actorId,
      movedAt: new Date().toISOString(),
    };
    demoDisplayMovements.push(movement);
    return movement;
  }

  const { data, error } = await requireSupabaseClient()
    .from("display_movements")
    .insert({
      pan_uuid: input.panUuid,
      store_location_id: input.storeLocationId,
      fill_state: input.fillState,
      weight_kg: input.weightKg,
      moved_by: input.actorId,
    })
    .select()
    .single();

  if (error) throw error;
  return mapDisplayMovement(data);
}

async function findEodCount(locationId: string, businessDate: string): Promise<EodCount | null> {
  if (!isSupabaseConfigured) {
    return demoEodCounts.find((count) => count.locationId === locationId && count.businessDate === businessDate) ?? null;
  }

  const { data, error } = await requireSupabaseClient()
    .from("end_of_day_counts")
    .select("*")
    .eq("location_id", locationId)
    .eq("business_date", businessDate)
    .limit(1);

  if (error) throw error;
  return data[0] ? mapEodCount(data[0]) : null;
}

async function findEodCountById(countId: string): Promise<EodCount | null> {
  if (!isSupabaseConfigured) {
    return demoEodCounts.find((count) => count.id === countId) ?? null;
  }

  const { data, error } = await requireSupabaseClient()
    .from("end_of_day_counts")
    .select("*")
    .eq("id", countId)
    .limit(1);

  if (error) throw error;
  return data[0] ? mapEodCount(data[0]) : null;
}

async function listEodItems(countId: string): Promise<EodCountItem[]> {
  if (!isSupabaseConfigured) {
    return demoEodCountItems.filter((item) => item.countId === countId);
  }

  const { data, error } = await requireSupabaseClient()
    .from("end_of_day_count_items")
    .select("*")
    .eq("count_id", countId);

  if (error) throw error;
  return data.map(mapEodCountItem);
}

async function replaceEodItems(countId: string, items: EodCountInput["items"]): Promise<EodCountItem[]> {
  if (!isSupabaseConfigured) {
    demoEodCountItems = demoEodCountItems.filter((item) => item.countId !== countId || item.catalogItemId !== null);
    const created = items.map((item): EodCountItem => ({
      id: makeId("eod-item"),
      countId,
      panId: item.panUuid ?? null,
      flavourId: item.flavourId ?? null,
      catalogItemId: null,
      quantity: null,
      weightKg: item.weightKg,
      unit: "kg",
      notes: item.notes ?? null,
    }));
    demoEodCountItems.push(...created);
    return created;
  }

  const supabase = requireSupabaseClient();
  const { error: deleteError } = await supabase
    .from("end_of_day_count_items")
    .delete()
    .eq("count_id", countId)
    .is("catalog_item_id", null);
  if (deleteError) throw deleteError;

  if (items.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("end_of_day_count_items")
    .insert(
      items.map((item) => ({
        count_id: countId,
        pan_uuid: item.panUuid ?? null,
        flavour_id: item.flavourId ?? null,
        weight_kg: item.weightKg,
        unit: "kg",
        notes: item.notes ?? null,
      })),
    )
    .select();

  if (error) throw error;
  return data.map(mapEodCountItem);
}

export async function listIncomingDispatches(locationId: string): Promise<IncomingDispatch[]> {
  const dispatches = (await listLabDispatches()).filter(
    (dispatch) => dispatch.toLocationId === locationId && dispatch.status === "pending",
  );

  return Promise.all(
    dispatches.map(async (dispatch) => {
      const items = await listDispatchItems(dispatch.id);
      const pans = await listPansByIds(items.map((item) => item.panId));
      return { ...dispatch, pans };
    }),
  );
}

export async function listStoreReceipts(locationId?: string): Promise<StoreReceipt[]> {
  if (!isSupabaseConfigured) {
    return demoReceipts.filter((receipt) => !locationId || receipt.locationId === locationId);
  }

  let query = requireSupabaseClient().from("store_receipts").select("*").order("received_at");
  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapReceipt);
}

export async function acceptIncomingDispatch(input: AcceptDispatchInput): Promise<StoreReceipt> {
  assertStoreLocation(input, input.locationId);

  const incoming = await listIncomingDispatches(input.locationId);
  const dispatch = incoming.find((item) => item.id === input.dispatchId);
  if (!dispatch) {
    throw new Error("Incoming dispatch not found for this store.");
  }

  const receipt = await createReceipt(input);
  await Promise.all(
    dispatch.pans.map((pan) =>
      updatePanState(pan.id, {
        currentLocationId: input.locationId,
        panRole: "backup",
        status: "received",
      }),
    ),
  );
  await updateDispatchStatus(input.dispatchId, "accepted");
  return receipt;
}

export async function listStorePans(locationId: string): Promise<Pan[]> {
  const pans = await listAllPans();
  return pans.filter((pan) => pan.currentLocationId === locationId && pan.active);
}

export async function listBackupPans(locationId: string): Promise<Pan[]> {
  const pans = await listStorePans(locationId);
  return pans.filter((pan) => pan.status === "received" && pan.panRole === "backup");
}

export async function listDisplayPans(locationId: string): Promise<Pan[]> {
  const pans = await listStorePans(locationId);
  return pans.filter((pan) => pan.status === "display" && pan.panRole === "display");
}

export async function listDisplayMovements(locationId?: string): Promise<DisplayMovement[]> {
  if (!isSupabaseConfigured) {
    return demoDisplayMovements.filter((movement) => !locationId || movement.storeLocationId === locationId);
  }

  let query = requireSupabaseClient().from("display_movements").select("*").order("moved_at");
  if (locationId) {
    query = query.eq("store_location_id", locationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapDisplayMovement);
}

export async function movePanToDisplay(input: DisplayMovementInput): Promise<DisplayMovement> {
  assertStoreLocation(input, input.storeLocationId);

  if (input.fillState === "partial" && (!input.weightKg || input.weightKg <= 0)) {
    throw new Error("Partial pans require a weight.");
  }

  if (input.fillState === "partial") {
    const partialWeightError = validateGelatoPanWeightKg(input.weightKg!, { fieldName: "Partial pan weight" });
    if (partialWeightError) {
      throw new Error(partialWeightError);
    }
  }

  const backupPans = await listBackupPans(input.storeLocationId);
  const pan = backupPans.find((item) => item.id === input.panUuid);
  if (!pan) {
    throw new Error("Only backup pans in this store can be moved to display.");
  }

  const displayWeightKg = input.fillState === "full" ? pan.fullWeightKg ?? pan.currentWeightKg : input.weightKg;
  if (!displayWeightKg || displayWeightKg <= 0) {
    throw new Error("Display weight is required.");
  }
  const displayWeightError = validateGelatoPanWeightKg(displayWeightKg, { fieldName: "Display weight" });
  if (displayWeightError) {
    throw new Error(displayWeightError);
  }

  const movement = await createDisplayMovement({ ...input, weightKg: displayWeightKg });
  await updatePanState(pan.id, {
    currentWeightKg: displayWeightKg,
    panRole: "display",
    status: "display",
  });
  return movement;
}

export async function submitEodGelatoCount(input: EodCountInput): Promise<EodCountWithItems> {
  assertStoreLocation(input, input.locationId);

  const weightError = input.items
    .map((item) => validateGelatoPanWeightKg(item.weightKg, { fieldName: "EOD gelato weight", allowZero: true }))
    .find(Boolean);
  if (weightError) {
    throw new Error(weightError);
  }

  const displayPans = await listDisplayPans(input.locationId);
  const displayPanById = new Map(displayPans.map((pan) => [pan.id, pan]));
  const displayFlavourIds = new Set(displayPans.map((pan) => pan.flavourId));
  const normalizedItems = input.items.map((item) => ({
    ...item,
    panUuid: item.panUuid ?? null,
    flavourId: item.flavourId ?? (item.panUuid ? displayPanById.get(item.panUuid)?.flavourId ?? null : null),
  }));
  const hasInvalidPan = normalizedItems.some((item) => item.panUuid && !displayPanById.has(item.panUuid));
  if (hasInvalidPan) {
    throw new Error("End-of-day gelato counts can only include display pans.");
  }
  const hasInvalidFlavour = normalizedItems.some((item) => !item.flavourId || !displayFlavourIds.has(item.flavourId));
  if (hasInvalidFlavour) {
    throw new Error("End-of-day gelato counts can only include display flavours or pans.");
  }

  const existing = await findEodCount(input.locationId, input.businessDate);
  if (existing) {
    assertCanCorrectCount(input, input.businessDate);
  }

  const count = existing
    ? await updateEodCount(existing.id, {
        status: "corrected",
        correctedBy: input.actorId,
        correctedAt: new Date().toISOString(),
        notes: input.notes,
      })
    : await createEodCount(input);

  const items = await replaceEodItems(count.id, normalizedItems);
  await Promise.all(
    normalizedItems
      .filter((item) => item.panUuid)
      .map((item) =>
        updatePanState(item.panUuid!, {
          currentWeightKg: item.weightKg,
        }),
      ),
  );

  return { ...count, items };
}

async function createEodCount(input: EodCountInput): Promise<EodCount> {
  if (!isSupabaseConfigured) {
    const count: EodCount = {
      id: makeId("eod-count"),
      locationId: input.locationId,
      businessDate: input.businessDate,
      status: "submitted",
      submittedBy: input.actorId,
      submittedAt: new Date().toISOString(),
      correctedBy: null,
      correctedAt: null,
      notes: input.notes,
    };
    demoEodCounts.push(count);
    return count;
  }

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
  return mapEodCount(data);
}

async function updateEodCount(
  countId: string,
  patch: Pick<EodCount, "status" | "correctedBy" | "correctedAt" | "notes">,
): Promise<EodCount> {
  if (!isSupabaseConfigured) {
    const existing = demoEodCounts.find((count) => count.id === countId);
    if (!existing) throw new Error("End-of-day count not found.");
    existing.status = patch.status;
    existing.correctedBy = patch.correctedBy;
    existing.correctedAt = patch.correctedAt;
    existing.notes = patch.notes;
    return { ...existing };
  }

  const { data, error } = await requireSupabaseClient()
    .from("end_of_day_counts")
    .update({
      status: patch.status,
      corrected_by: patch.correctedBy,
      corrected_at: patch.correctedAt,
      notes: patch.notes,
    })
    .eq("id", countId)
    .select()
    .single();

  if (error) throw error;
  return mapEodCount(data);
}

export async function getEodCount(locationId: string, businessDate: string): Promise<EodCountWithItems | null> {
  const count = await findEodCount(locationId, businessDate);
  if (!count) return null;
  return { ...count, items: await listEodItems(count.id) };
}

export async function correctEodGelatoCountItem(input: EodGelatoCorrectionInput): Promise<EodCountWithItems> {
  const weightError = validateGelatoPanWeightKg(input.weightKg, {
    fieldName: "Corrected gelato weight",
    allowZero: true,
  });
  if (weightError) {
    throw new Error(weightError);
  }

  const count = await findEodCountById(input.countId);
  if (!count) {
    throw new Error("End-of-day count not found.");
  }

  const items = await listEodItems(input.countId);
  const existingItem = items.find((item) => item.id === input.itemId);
  if (!existingItem || !isGelatoEodItem(existingItem)) {
    throw new Error("End-of-day gelato item not found.");
  }

  if (!isSupabaseConfigured) {
    existingItem.weightKg = input.weightKg;
    existingItem.unit = "kg";
  } else {
    const { error } = await requireSupabaseClient()
      .from("end_of_day_count_items")
      .update({
        weight_kg: input.weightKg,
        unit: "kg",
      })
      .eq("id", input.itemId)
      .eq("count_id", input.countId);

    if (error) throw error;
  }

  const corrected = await updateEodCount(input.countId, {
    status: "corrected",
    correctedBy: input.correctedBy,
    correctedAt: new Date().toISOString(),
    notes: count.notes,
  });

  return { ...corrected, items: (await listEodItems(input.countId)).filter(isGelatoEodItem) };
}

export async function listEodGelatoCounts(): Promise<EodCountWithItems[]> {
  if (!isSupabaseConfigured) {
    return demoEodCounts.map((count) => ({
      ...count,
      items: demoEodCountItems.filter((item) => item.countId === count.id && isGelatoEodItem(item)),
    }));
  }

  const { data, error } = await requireSupabaseClient()
    .from("end_of_day_counts")
    .select("*")
    .order("business_date", { ascending: false });

  if (error) throw error;

  return Promise.all(
    data.map(async (row) => {
      const count = mapEodCount(row);
      return {
        ...count,
        items: (await listEodItems(count.id)).filter(isGelatoEodItem),
      };
    }),
  );
}
