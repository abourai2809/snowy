import type { Dispatch } from "../../domain/dispatches";
import type {
  DeepFreezerCountType,
  EmptyPanPhysicalCount,
  EmptyPanReturn,
  EmptyPanReturnStatus,
  EodCount,
  EodCountItem,
  DisplayMovement,
  FillState,
  StoreReceipt,
} from "../../domain/inventory";
import { isActiveDisplayAssignment, isDeepFreezerPan } from "../../domain/pans";
import type { Pan, PanEvent, PanRole } from "../../domain/pans";
import { isStoreRole, type AppRole } from "../../domain/roles";
import { validateGelatoPanWeightKg } from "../../domain/weights";
import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import { listFlavours } from "../catalog/catalogApi";
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
  panReceiptStatusByPanId: Record<string, IncomingPanReceiptStatus>;
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

export type RejectDispatchInput = AcceptDispatchInput;
export type OverturnRejectedDispatchInput = AcceptDispatchInput;
export type IncomingPanReceiptStatus = "pending" | "accepted" | "missing" | "rejected";
export type IncomingPanReceiptDecisionStatus = Exclude<IncomingPanReceiptStatus, "pending">;

export interface IncomingPanReceiptDecision {
  panUuid: string;
  status: IncomingPanReceiptDecisionStatus;
  notes?: string | null;
}

export interface ReceiveIncomingPansInput extends StoreActor {
  dispatchId: string;
  locationId: string;
  decisions: IncomingPanReceiptDecision[];
  notes: string | null;
}

export interface DisplayMovementInput extends StoreActor {
  panUuid: string;
  storeLocationId: string;
  fillState: FillState;
  weightKg: number | null;
  fifoOverride?: boolean;
  recommendedPanUuid?: string | null;
}

export interface CheckoutDisplayPanInput extends StoreActor {
  panUuid: string;
  storeLocationId: string;
  weightKg: number;
}

export interface SwapDisplayPanInput extends StoreActor {
  panUuid: string;
  storeLocationId: string;
  checkoutPanUuid?: string | null;
  checkoutWeightKg?: number | null;
  fifoOverride?: boolean;
  recommendedPanUuid?: string | null;
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

export interface EodDisplayPanRow {
  pan: Pan;
  openingWeightKg: number;
  lockedEmpty: boolean;
}

export interface EodGelatoCorrectionInput {
  countId: string;
  itemId: string;
  weightKg: number;
  correctedBy: string | null;
}

export interface StoreEmptyPanCount {
  locationId: string;
  emptyPanCount: number;
}

export interface EmptyPanReturnInput extends StoreActor {
  sourceLocationId: string;
  quantity: number;
  notes: string | null;
}

export interface EmptyPanReturnResolutionInput extends StoreActor {
  returnId: string;
  notes: string | null;
}

export interface EmptyPanPhysicalCountInput extends StoreActor {
  locationId: string;
  businessDate: string;
  countType: DeepFreezerCountType;
  physicalCount: number;
  notes: string | null;
}

export interface EmptyPanPhysicalCountResolutionInput extends StoreActor {
  countId: string;
  notes: string | null;
}

type NormalizedEodItem = {
  panUuid: string | null;
  flavourId: string | null;
  weightKg: number;
  notes?: string | null;
};

interface PanEventInput {
  panUuid: string;
  eventType: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  fromRole: PanRole | null;
  toRole: PanRole | null;
  weightKg: number | null;
  recordedBy: string | null;
  metadata?: Record<string, unknown>;
}

let demoReceipts: StoreReceipt[] = [];
let demoDisplayMovements: DisplayMovement[] = [];
let demoEodCounts: EodCount[] = [];
let demoEodCountItems: EodCountItem[] = [];
let demoPanEvents: PanEvent[] = [];
let demoEmptyPanReturns: EmptyPanReturn[] = [];
let demoEmptyPanPhysicalCounts: EmptyPanPhysicalCount[] = [];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function formatWeightKg(weightKg: number): string {
  return Number.isInteger(weightKg) ? String(weightKg) : weightKg.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
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

function mapPanEvent(row: Record<string, unknown>): PanEvent {
  return {
    id: String(row.id),
    panUuid: String(row.pan_uuid),
    eventType: String(row.event_type),
    fromLocationId: row.from_location_id ? String(row.from_location_id) : null,
    toLocationId: row.to_location_id ? String(row.to_location_id) : null,
    fromRole: row.from_role ? (row.from_role as PanRole) : null,
    toRole: row.to_role ? (row.to_role as PanRole) : null,
    weightKg: row.weight_kg === null || row.weight_kg === undefined ? null : Number(row.weight_kg),
    recordedBy: row.recorded_by ? String(row.recorded_by) : null,
    recordedAt: String(row.recorded_at),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
  };
}

function mapEmptyPanReturn(row: Record<string, unknown>): EmptyPanReturn {
  return {
    id: String(row.id),
    sourceLocationId: String(row.source_location_id),
    destinationLocationId: String(row.destination_location_id),
    quantity: Number(row.quantity),
    status: row.status as EmptyPanReturnStatus,
    createdBy: row.created_by ? String(row.created_by) : null,
    sentAt: String(row.sent_at),
    receivedBy: row.received_by ? String(row.received_by) : null,
    receivedAt: row.received_at ? String(row.received_at) : null,
    notes: row.notes ? String(row.notes) : null,
    resolutionNotes: row.resolution_notes ? String(row.resolution_notes) : null,
  };
}

function mapEmptyPanPhysicalCount(row: Record<string, unknown>): EmptyPanPhysicalCount {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    businessDate: String(row.business_date),
    countType: row.count_type as DeepFreezerCountType,
    physicalCount: Number(row.physical_count),
    appCalculatedCount: Number(row.app_calculated_count),
    variance: Number(row.variance),
    status: row.status as EmptyPanPhysicalCount["status"],
    countedBy: row.counted_by ? String(row.counted_by) : null,
    countedAt: String(row.counted_at),
    resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

function isGelatoEodItem(item: EodCountItem): boolean {
  return item.panId !== null || item.flavourId !== null;
}

function statusForReceiptEvent(eventType: string): IncomingPanReceiptDecisionStatus | null {
  if (eventType === "incoming_pan_accepted") return "accepted";
  if (eventType === "incoming_pan_missing") return "missing";
  if (eventType === "incoming_pan_rejected") return "rejected";
  return null;
}

function eventTypeForReceiptStatus(status: IncomingPanReceiptDecisionStatus): string {
  if (status === "accepted") return "incoming_pan_accepted";
  if (status === "missing") return "incoming_pan_missing";
  return "incoming_pan_rejected";
}

function summarizeDispatchReceiptStatus(
  pans: Pan[],
  panReceiptStatusByPanId: Record<string, IncomingPanReceiptStatus>,
): Dispatch["status"] {
  const statuses = pans.map((pan) => panReceiptStatusByPanId[pan.id] ?? "pending");
  const acceptedCount = statuses.filter((status) => status === "accepted").length;
  const rejectedCount = statuses.filter((status) => status === "missing" || status === "rejected").length;
  const pendingCount = statuses.filter((status) => status === "pending").length;

  if (acceptedCount === statuses.length && statuses.length > 0) return "accepted";
  if (acceptedCount > 0 && (rejectedCount > 0 || pendingCount > 0)) return "partially_accepted";
  if (acceptedCount === 0 && pendingCount === 0 && rejectedCount > 0) return "rejected";
  return "pending";
}

export function resetDemoStoreData() {
  demoReceipts = [];
  demoDisplayMovements = [];
  demoEodCounts = [];
  demoEodCountItems = [];
  demoPanEvents = [];
  demoEmptyPanReturns = [];
  demoEmptyPanPhysicalCounts = [];
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

function assertLabOrAdmin(actor: StoreActor) {
  if (actor.actorRole === "admin" || actor.actorRole === "lab_manager" || actor.actorRole === "lab_staff") {
    return;
  }

  throw new Error("Only Lab or Admin can receive empty pan returns.");
}

function assertCanResolveStoreReview(actor: StoreActor, locationId: string) {
  if (actor.actorRole === "admin") {
    return;
  }

  if (actor.actorRole === "store_manager" && actor.actorLocationId === locationId) {
    return;
  }

  throw new Error("Only Store Manager or Admin can resolve this review.");
}

function assertPositiveWholeQuantity(quantity: number, fieldName: string) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`${fieldName} must be a whole number greater than zero.`);
  }
}

function assertNonnegativeWholeQuantity(quantity: number, fieldName: string) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`${fieldName} must be a whole number zero or greater.`);
  }
}

function sortPansFifo(pans: Pan[]): Pan[] {
  return [...pans].sort((a, b) => {
    const producedAt = new Date(a.producedAt).getTime() - new Date(b.producedAt).getTime();
    if (producedAt !== 0) return producedAt;
    return a.panId.localeCompare(b.panId);
  });
}

function displayCapacityKg(pan: Pan): number {
  return pan.currentWeightKg ?? pan.fullWeightKg ?? 0;
}

function isOpenOrPartialPan(pan: Pan): boolean {
  if (!pan.active || (pan.currentWeightKg ?? 0) <= 0) return false;
  if (pan.status === "returned") return true;
  return (
    pan.status === "display" &&
    pan.fullWeightKg !== null &&
    pan.currentWeightKg !== null &&
    pan.currentWeightKg < pan.fullWeightKg
  );
}

async function assertNoOtherOpenOrPartialPan(locationId: string, flavourId: string, excludedPanIds: string[] = []) {
  const excluded = new Set(excludedPanIds);
  const existing = (await listStorePans(locationId)).filter(
    (pan) => pan.flavourId === flavourId && !excluded.has(pan.id) && isOpenOrPartialPan(pan),
  );

  if (existing.length > 0) {
    throw new Error("Only one open or partial pan is allowed for this flavour at this store. Ask Admin to resolve the extra partial pan first.");
  }
}

async function createReceipt(input: AcceptDispatchInput, status: StoreReceipt["status"] = "accepted"): Promise<StoreReceipt> {
  if (!isSupabaseConfigured) {
    const receipt: StoreReceipt = {
      id: makeId("receipt"),
      dispatchId: input.dispatchId,
      locationId: input.locationId,
      status,
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
      status,
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

async function recordPanEvent(input: PanEventInput): Promise<PanEvent> {
  if (!isSupabaseConfigured) {
    const event: PanEvent = {
      id: makeId("pan-event"),
      panUuid: input.panUuid,
      eventType: input.eventType,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      fromRole: input.fromRole,
      toRole: input.toRole,
      weightKg: input.weightKg,
      recordedBy: input.recordedBy,
      recordedAt: new Date().toISOString(),
      metadata: input.metadata ?? {},
    };
    demoPanEvents.push(event);
    return event;
  }

  const { data, error } = await requireSupabaseClient()
    .from("pan_events")
    .insert({
      pan_uuid: input.panUuid,
      event_type: input.eventType,
      from_location_id: input.fromLocationId,
      to_location_id: input.toLocationId,
      from_role: input.fromRole,
      to_role: input.toRole,
      weight_kg: input.weightKg,
      recorded_by: input.recordedBy,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return mapPanEvent(data);
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
    (dispatch) =>
      dispatch.toLocationId === locationId &&
      (dispatch.status === "pending" || dispatch.status === "partially_accepted"),
  );

  const hydrated = await hydrateDispatchPans(dispatches);
  return hydrated.filter((dispatch) =>
    dispatch.pans.some((pan) => (dispatch.panReceiptStatusByPanId[pan.id] ?? "pending") === "pending"),
  );
}

export async function listRejectedDispatches(locationId: string): Promise<IncomingDispatch[]> {
  const dispatches = (await listLabDispatches()).filter(
    (dispatch) =>
      dispatch.toLocationId === locationId &&
      (dispatch.status === "pending" || dispatch.status === "rejected" || dispatch.status === "partially_accepted"),
  );

  const hydrated = await hydrateDispatchPans(dispatches);
  return hydrated.filter((dispatch) =>
    dispatch.pans.some((pan) => {
      const status = dispatch.panReceiptStatusByPanId[pan.id] ?? "pending";
      return status === "missing" || status === "rejected";
    }),
  );
}

async function hydrateDispatchPans(dispatches: Dispatch[]): Promise<IncomingDispatch[]> {
  return Promise.all(
    dispatches.map(async (dispatch) => {
      const items = await listDispatchItems(dispatch.id);
      const pans = await listPansByIds(items.map((item) => item.panId));
      const panReceiptStatusByPanId = await listPanReceiptStatuses(dispatch, pans);
      return { ...dispatch, pans, panReceiptStatusByPanId };
    }),
  );
}

async function listPanReceiptStatuses(
  dispatch: Dispatch,
  pans: Pan[],
): Promise<Record<string, IncomingPanReceiptStatus>> {
  const statuses = Object.fromEntries(pans.map((pan): [string, IncomingPanReceiptStatus] => [pan.id, "pending"]));
  const panIds = new Set(pans.map((pan) => pan.id));
  const events = (await listPanEvents(dispatch.toLocationId))
    .filter((event) => event.metadata.dispatchId === dispatch.id && panIds.has(event.panUuid))
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  events.forEach((event) => {
    const status = statusForReceiptEvent(event.eventType);
    if (status) {
      statuses[event.panUuid] = status;
    }
  });

  if (dispatch.status === "rejected" && events.length === 0) {
    pans.forEach((pan) => {
      statuses[pan.id] = "rejected";
    });
  }

  if (dispatch.status === "accepted" && events.length === 0) {
    pans.forEach((pan) => {
      statuses[pan.id] = "accepted";
    });
  }

  return statuses;
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

async function getReceivableDispatch(dispatchId: string, locationId: string): Promise<IncomingDispatch | null> {
  const dispatch = (await listLabDispatches()).find(
    (item) =>
      item.id === dispatchId &&
      item.toLocationId === locationId &&
      (item.status === "pending" || item.status === "partially_accepted" || item.status === "rejected"),
  );
  if (!dispatch) {
    return null;
  }

  const [hydrated] = await hydrateDispatchPans([dispatch]);
  return hydrated ?? null;
}

function summarizeReceiptNotes(
  dispatch: IncomingDispatch,
  decisions: IncomingPanReceiptDecision[],
  fallback: string | null,
): string | null {
  if (fallback) return fallback;

  const panById = new Map(dispatch.pans.map((pan): [string, Pan] => [pan.id, pan]));
  return decisions
    .map((decision) => {
      const panId = panById.get(decision.panUuid)?.panId ?? decision.panUuid;
      return `${panId}: ${decision.status}`;
    })
    .join("; ");
}

export async function receiveIncomingDispatchPans(input: ReceiveIncomingPansInput): Promise<StoreReceipt> {
  assertStoreLocation(input, input.locationId);

  if (input.decisions.length === 0) {
    throw new Error("Choose at least one pan to receive.");
  }

  const dispatch = await getReceivableDispatch(input.dispatchId, input.locationId);
  if (!dispatch) {
    throw new Error("Incoming dispatch not found for this store.");
  }

  const panById = new Map(dispatch.pans.map((pan): [string, Pan] => [pan.id, pan]));
  const nextStatuses = { ...dispatch.panReceiptStatusByPanId };

  input.decisions.forEach((decision) => {
    if (!panById.has(decision.panUuid)) {
      throw new Error("Selected pan is not part of this dispatch.");
    }
    if (nextStatuses[decision.panUuid] === "accepted" && decision.status !== "accepted") {
      throw new Error("Accepted pans cannot be marked missing or rejected.");
    }
  });

  const receiptStatus: StoreReceipt["status"] = input.decisions.some((decision) => decision.status === "accepted")
    ? "accepted"
    : "rejected";
  const receipt = await createReceipt(
    {
      dispatchId: input.dispatchId,
      locationId: input.locationId,
      notes: summarizeReceiptNotes(dispatch, input.decisions, input.notes),
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorLocationId: input.actorLocationId,
    },
    receiptStatus,
  );

  await Promise.all(
    input.decisions.map(async (decision) => {
      const pan = panById.get(decision.panUuid)!;
      if (decision.status === "accepted") {
        await updatePanState(pan.id, {
          currentLocationId: input.locationId,
          panRole: "backup",
          status: "received",
        });
      }

      await recordPanEvent({
        panUuid: pan.id,
        eventType: eventTypeForReceiptStatus(decision.status),
        fromLocationId: dispatch.fromLocationId,
        toLocationId: input.locationId,
        fromRole: "backup",
        toRole: decision.status === "accepted" ? "backup" : "store",
        weightKg: decision.status === "accepted" ? pan.currentWeightKg ?? pan.fullWeightKg ?? null : null,
        recordedBy: input.actorId,
        metadata: {
          dispatchId: dispatch.id,
          dispatchCode: dispatch.dispatchCode,
          receiptId: receipt.id,
          receiptStatus: decision.status,
          notes: decision.notes ?? null,
        },
      });
      nextStatuses[pan.id] = decision.status;
    }),
  );

  await updateDispatchStatus(input.dispatchId, summarizeDispatchReceiptStatus(dispatch.pans, nextStatuses));
  return receipt;
}

export async function acceptIncomingDispatch(input: AcceptDispatchInput): Promise<StoreReceipt> {
  assertStoreLocation(input, input.locationId);

  const dispatch = await getReceivableDispatch(input.dispatchId, input.locationId);
  if (!dispatch) {
    throw new Error("Incoming dispatch not found for this store.");
  }
  const decisions = dispatch.pans
    .filter((pan) => (dispatch.panReceiptStatusByPanId[pan.id] ?? "pending") === "pending")
    .map((pan): IncomingPanReceiptDecision => ({ panUuid: pan.id, status: "accepted" }));

  return receiveIncomingDispatchPans({ ...input, decisions });
}

export async function rejectIncomingDispatch(input: RejectDispatchInput): Promise<StoreReceipt> {
  assertStoreLocation(input, input.locationId);

  const dispatch = await getReceivableDispatch(input.dispatchId, input.locationId);
  if (!dispatch) {
    throw new Error("Incoming dispatch not found for this store.");
  }
  const decisions = dispatch.pans
    .filter((pan) => (dispatch.panReceiptStatusByPanId[pan.id] ?? "pending") === "pending")
    .map((pan): IncomingPanReceiptDecision => ({ panUuid: pan.id, status: "rejected" }));

  return receiveIncomingDispatchPans({ ...input, decisions });
}

export async function overturnRejectedDispatch(input: OverturnRejectedDispatchInput): Promise<StoreReceipt> {
  assertStoreLocation(input, input.locationId);

  const dispatch = await getReceivableDispatch(input.dispatchId, input.locationId);
  if (!dispatch) {
    throw new Error("Rejected dispatch not found for this store.");
  }

  const decisions = dispatch.pans
    .filter((pan) => {
      const status = dispatch.panReceiptStatusByPanId[pan.id] ?? "pending";
      return status === "missing" || status === "rejected";
    })
    .map((pan): IncomingPanReceiptDecision => ({ panUuid: pan.id, status: "accepted" }));

  return receiveIncomingDispatchPans({ ...input, decisions });
}

export async function listStorePans(locationId: string): Promise<Pan[]> {
  const pans = await listAllPans();
  return pans.filter((pan) => pan.currentLocationId === locationId && pan.active);
}

export async function listBackupPans(locationId: string): Promise<Pan[]> {
  const pans = await listStorePans(locationId);
  return sortPansFifo(pans.filter(isDeepFreezerPan));
}

export async function listDisplayPans(locationId: string): Promise<Pan[]> {
  const pans = await listStorePans(locationId);
  return pans.filter(isActiveDisplayAssignment);
}

export async function listEodDisplayPanRows(locationId: string, businessDate: string): Promise<EodDisplayPanRow[]> {
  const [activeDisplayPans, movements, existingCount] = await Promise.all([
    listDisplayPans(locationId),
    listDisplayMovements(locationId),
    findEodCount(locationId, businessDate),
  ]);
  const existingItems = existingCount ? await listEodItems(existingCount.id) : [];
  const existingWeightByPanId = new Map(
    existingItems
      .filter((item) => item.panId)
      .map((item): [string, number] => [item.panId!, item.weightKg ?? 0]),
  );
  const todayMovements = movements.filter((movement) => dateKey(movement.movedAt) === businessDate);
  const latestMovementByPanId = new Map<string, DisplayMovement>();

  todayMovements.forEach((movement) => {
    const existing = latestMovementByPanId.get(movement.panId);
    if (!existing || new Date(movement.movedAt).getTime() > new Date(existing.movedAt).getTime()) {
      latestMovementByPanId.set(movement.panId, movement);
    }
  });

  const activePanIds = activeDisplayPans.map((pan) => pan.id);
  const movementPanIds = todayMovements.map((movement) => movement.panId);
  const existingPanIds = existingItems.map((item) => item.panId).filter((panId): panId is string => Boolean(panId));
  const panIds = [...new Set([...activePanIds, ...movementPanIds, ...existingPanIds])];
  const knownPans = new Map(activeDisplayPans.map((pan): [string, Pan] => [pan.id, pan]));
  const missingPanIds = panIds.filter((panId) => !knownPans.has(panId));
  const missingPans = await listPansByIds(missingPanIds);
  missingPans.forEach((pan) => knownPans.set(pan.id, pan));

  return panIds
    .map((panId) => {
      const pan = knownPans.get(panId);
      if (!pan) return null;

      const movement = latestMovementByPanId.get(pan.id);
      const existingWeightKg = existingWeightByPanId.get(pan.id);
      const fallbackCorrectionCeiling = existingWeightKg !== undefined ? pan.fullWeightKg ?? 0 : 0;
      const openingWeightKg =
        movement?.weightKg ?? Math.max(pan.currentWeightKg ?? 0, existingWeightKg ?? 0, fallbackCorrectionCeiling);
      return {
        pan,
        openingWeightKg,
        lockedEmpty: !pan.active || pan.status === "closed",
      };
    })
    .filter((row): row is EodDisplayPanRow => Boolean(row))
    .sort((a, b) => {
      const flavour = a.pan.flavourId.localeCompare(b.pan.flavourId);
      if (flavour !== 0) return flavour;
      return a.pan.panId.localeCompare(b.pan.panId);
    });
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

export async function listPanEvents(locationId?: string): Promise<PanEvent[]> {
  if (!isSupabaseConfigured) {
    return demoPanEvents.filter(
      (event) => !locationId || event.fromLocationId === locationId || event.toLocationId === locationId,
    );
  }

  let query = requireSupabaseClient().from("pan_events").select("*").order("recorded_at");
  if (locationId) {
    query = query.or(`from_location_id.eq.${locationId},to_location_id.eq.${locationId}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapPanEvent);
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
    throw new Error("Only deep freezer pans in this store can be moved to display.");
  }
  if (isOpenOrPartialPan(pan)) {
    await assertNoOtherOpenOrPartialPan(input.storeLocationId, pan.flavourId, [pan.id]);
  }

  const displayPans = await listDisplayPans(input.storeLocationId);
  const conflictingDisplayPan = displayPans.find((item) => item.flavourId === pan.flavourId && item.id !== pan.id);
  if (conflictingDisplayPan) {
    throw new Error("Check out the current display pan for this flavour before moving another pan to display.");
  }

  const isReturnedPartialPan =
    pan.status === "returned" &&
    pan.currentWeightKg !== null &&
    (pan.fullWeightKg === null || pan.currentWeightKg < pan.fullWeightKg);
  const fillState = isReturnedPartialPan ? "partial" : input.fillState;
  const displayWeightKg = fillState === "full" ? pan.fullWeightKg ?? pan.currentWeightKg : input.weightKg ?? pan.currentWeightKg;
  if (!displayWeightKg || displayWeightKg <= 0) {
    throw new Error("Display weight is required.");
  }
  const displayWeightError = validateGelatoPanWeightKg(displayWeightKg, { fieldName: "Display weight" });
  if (displayWeightError) {
    throw new Error(displayWeightError);
  }

  const movement = await createDisplayMovement({ ...input, fillState, weightKg: displayWeightKg });
  await recordPanEvent({
    panUuid: pan.id,
    eventType: "moved_to_display",
    fromLocationId: pan.currentLocationId,
    toLocationId: input.storeLocationId,
    fromRole: pan.panRole,
    toRole: "display",
    weightKg: displayWeightKg,
    recordedBy: input.actorId,
    metadata: {
      fillState,
      movementId: movement.id,
      fifoOverride: Boolean(input.fifoOverride),
      recommendedPanUuid: input.recommendedPanUuid ?? null,
    },
  });
  await updatePanState(pan.id, {
    currentWeightKg: displayWeightKg,
    panRole: "display",
    status: "display",
  });
  return movement;
}

function displayMovementForPan(input: SwapDisplayPanInput, pan: Pan): DisplayMovementInput {
  const isPartial =
    pan.status === "returned" ||
    (pan.fullWeightKg !== null && pan.currentWeightKg !== null && pan.currentWeightKg < pan.fullWeightKg);

  return {
    panUuid: input.panUuid,
    storeLocationId: input.storeLocationId,
    fillState: isPartial ? "partial" : "full",
    weightKg: isPartial ? pan.currentWeightKg : null,
    actorId: input.actorId,
    actorRole: input.actorRole,
    actorLocationId: input.actorLocationId,
    fifoOverride: input.fifoOverride,
    recommendedPanUuid: input.recommendedPanUuid,
  };
}

export async function swapPanToDisplay(input: SwapDisplayPanInput): Promise<DisplayMovement> {
  assertStoreLocation(input, input.storeLocationId);

  const backupPans = await listBackupPans(input.storeLocationId);
  const pan = backupPans.find((item) => item.id === input.panUuid);
  if (!pan) {
    throw new Error("Only deep freezer pans in this store can be moved to display.");
  }
  if (isActiveDisplayAssignment(pan)) {
    throw new Error("Choose a deep freezer pan that is not already assigned to display.");
  }

  const displayPans = await listDisplayPans(input.storeLocationId);
  const currentDisplayPan = displayPans.find((item) => item.flavourId === pan.flavourId && item.id !== pan.id);
  if (currentDisplayPan) {
    if (input.checkoutPanUuid !== currentDisplayPan.id) {
      throw new Error("Confirm checkout for the current display pan before swapping.");
    }
    if (input.checkoutWeightKg === null || input.checkoutWeightKg === undefined) {
      throw new Error("Choose how to check out the current display pan.");
    }
    const selectedPanIsOpenOrPartial = isOpenOrPartialPan(pan);
    if (input.checkoutWeightKg > 0 && selectedPanIsOpenOrPartial) {
      throw new Error("Only one open or partial pan is allowed for this flavour at this store. Mark the old pan empty or choose a full pan.");
    }
  }

  const movementInput = displayMovementForPan(input, pan);
  if (currentDisplayPan) {
    await checkoutDisplayPan({
      panUuid: currentDisplayPan.id,
      storeLocationId: input.storeLocationId,
      weightKg: input.checkoutWeightKg!,
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorLocationId: input.actorLocationId,
    });
  }

  return movePanToDisplay(movementInput);
}

export async function checkoutDisplayPan(input: CheckoutDisplayPanInput): Promise<Pan> {
  assertStoreLocation(input, input.storeLocationId);

  if (!Number.isFinite(input.weightKg) || input.weightKg < 0) {
    throw new Error("Checkout weight must be zero or more kg.");
  }

  const weightError = validateGelatoPanWeightKg(input.weightKg, {
    fieldName: "Checkout weight",
    allowZero: true,
  });
  if (weightError) {
    throw new Error(weightError);
  }

  const displayPans = await listDisplayPans(input.storeLocationId);
  const pan = displayPans.find((item) => item.id === input.panUuid);
  if (!pan) {
    throw new Error("Only active display pans can be checked out.");
  }

  if (input.weightKg <= 0) {
    await recordPanEvent({
      panUuid: pan.id,
      eventType: "display_pan_depleted",
      fromLocationId: pan.currentLocationId,
      toLocationId: pan.currentLocationId,
      fromRole: pan.panRole,
      toRole: "store",
      weightKg: 0,
      recordedBy: input.actorId,
      metadata: { source: "display_checkout" },
    });
    return updatePanState(pan.id, {
      currentWeightKg: 0,
      panRole: "store",
      status: "closed",
      active: false,
    });
  }

  await assertNoOtherOpenOrPartialPan(input.storeLocationId, pan.flavourId, [pan.id]);

  const alreadyInDeepFreezer = pan.status === "returned";
  if (alreadyInDeepFreezer) {
    const weightDelta = input.weightKg - (pan.currentWeightKg ?? 0);
    if (weightDelta !== 0) {
      await recordPanEvent({
        panUuid: pan.id,
        eventType: "display_pan_deep_weight_adjusted",
        fromLocationId: pan.currentLocationId,
        toLocationId: pan.currentLocationId,
        fromRole: pan.panRole,
        toRole: pan.panRole,
        weightKg: weightDelta,
        recordedBy: input.actorId,
        metadata: { source: "display_checkout" },
      });
    }
  }
  await recordPanEvent({
    panUuid: pan.id,
    eventType: alreadyInDeepFreezer ? "display_pan_checked_out" : "display_pan_checked_out_to_deep",
    fromLocationId: pan.currentLocationId,
    toLocationId: pan.currentLocationId,
    fromRole: pan.panRole,
    toRole: "backup",
    weightKg: input.weightKg,
    recordedBy: input.actorId,
    metadata: { source: "display_checkout" },
  });
  return updatePanState(pan.id, {
    currentWeightKg: input.weightKg,
    panRole: "backup",
    status: "returned",
    active: true,
  });
}

async function normalizeEodItemsForLifecycle(
  input: EodCountInput,
  displayPans: Pan[],
  existingItems: EodCountItem[],
  openingWeightByPanId: Map<string, number> = new Map(),
): Promise<{ items: NormalizedEodItem[]; panById: Map<string, Pan> }> {
  const displayPanById = new Map(displayPans.map((pan) => [pan.id, pan]));
  const existingPanIds = new Set(existingItems.map((item) => item.panId).filter((panId): panId is string => Boolean(panId)));
  const baseItems = input.items.map((item) => ({
    ...item,
    panUuid: item.panUuid ?? null,
    flavourId: item.flavourId ?? null,
  }));
  const itemPanUuids = [...new Set(baseItems.map((item) => item.panUuid).filter((panUuid): panUuid is string => Boolean(panUuid)))];
  const itemPans = await listPansByIds(itemPanUuids);
  const panById = new Map([...displayPans, ...itemPans].map((pan) => [pan.id, pan]));
  const activeFlavourIds = new Set((await listFlavours(true)).map((flavour) => flavour.id));
  const movements = await listDisplayMovements(input.locationId);
  const movedAtByPanId = new Map<string, number>();
  movements.forEach((movement) => {
    movedAtByPanId.set(movement.panId, new Date(movement.movedAt).getTime());
  });

  const normalizedBaseItems = baseItems.map((item) => ({
    ...item,
    flavourId: item.flavourId ?? (item.panUuid ? panById.get(item.panUuid)?.flavourId ?? null : null),
  }));

  const hasInvalidPan = normalizedBaseItems.some((item) => {
    if (!item.panUuid) return false;

    const pan = panById.get(item.panUuid);
    if (!pan || pan.currentLocationId !== input.locationId) return true;

    return !displayPanById.has(item.panUuid) && !existingPanIds.has(item.panUuid);
  });
  if (hasInvalidPan) {
    throw new Error("End-of-day gelato counts can only include display pans.");
  }

  const hasInvalidFlavour = normalizedBaseItems.some((item) => !item.flavourId || !activeFlavourIds.has(item.flavourId));
  if (hasInvalidFlavour) {
    throw new Error("End-of-day gelato counts can only include active flavours or display pans.");
  }

  const closedPanItem = normalizedBaseItems.find((item) => {
    if (!item.panUuid || item.weightKg <= 0) return false;
    const pan = panById.get(item.panUuid);
    return Boolean(pan && (!pan.active || pan.status === "closed") && !existingPanIds.has(item.panUuid));
  });
  if (closedPanItem) {
    const pan = panById.get(closedPanItem.panUuid!);
    throw new Error(`${pan?.panId ?? "This pan"} is already marked empty. Its EOD weight must stay 0 kg.`);
  }

  const overOpeningItem = normalizedBaseItems.find((item) => {
    if (!item.panUuid) return false;
    const pan = panById.get(item.panUuid);
    if (!pan) return false;
    const openingWeightKg = openingWeightByPanId.get(item.panUuid) ?? displayCapacityKg(pan);
    return item.weightKg > openingWeightKg;
  });
  if (overOpeningItem) {
    const pan = panById.get(overOpeningItem.panUuid!);
    const openingWeightKg = openingWeightByPanId.get(overOpeningItem.panUuid!) ?? (pan ? displayCapacityKg(pan) : 0);
    throw new Error(
      `EOD weight for ${pan?.panId ?? "this pan"} cannot be higher than opening weight (${formatWeightKg(openingWeightKg)} kg).`,
    );
  }

  const inferredItems = normalizedBaseItems.flatMap((item): NormalizedEodItem[] => {
    if (item.panUuid) {
      return [{ panUuid: item.panUuid, flavourId: item.flavourId, weightKg: item.weightKg, notes: item.notes ?? null }];
    }

    const flavourDisplayPans = displayPans.filter((pan) => pan.flavourId === item.flavourId);
    if (flavourDisplayPans.length === 0) {
      return [
        {
          panUuid: null,
          flavourId: item.flavourId,
          weightKg: item.weightKg,
          notes: "review: no active display pan for this flavour",
        },
      ];
    }

    const totalCapacityKg = flavourDisplayPans.reduce(
      (sum, pan) => sum + (openingWeightByPanId.get(pan.id) ?? displayCapacityKg(pan)),
      0,
    );
    if (item.weightKg > totalCapacityKg) {
      return [
        {
          panUuid: null,
          flavourId: item.flavourId,
          weightKg: item.weightKg,
          notes: "review: EOD display weight exceeds active display pan capacity",
        },
      ];
    }

    if (flavourDisplayPans.length === 1) {
      return [
        {
          panUuid: flavourDisplayPans[0].id,
          flavourId: item.flavourId,
          weightKg: item.weightKg,
          notes: item.notes ?? null,
        },
      ];
    }

    let remainingWeightKg = item.weightKg;
    const allocationByPanId = new Map<string, number>();
    const newestFirst = [...flavourDisplayPans].sort((a, b) => {
      const movedAt = (movedAtByPanId.get(b.id) ?? 0) - (movedAtByPanId.get(a.id) ?? 0);
      if (movedAt !== 0) return movedAt;
      return b.panId.localeCompare(a.panId);
    });

    newestFirst.forEach((pan) => {
      const allocated = Math.min(openingWeightByPanId.get(pan.id) ?? displayCapacityKg(pan), remainingWeightKg);
      allocationByPanId.set(pan.id, allocated);
      remainingWeightKg -= allocated;
    });

    return [...flavourDisplayPans]
      .sort((a, b) => {
        const movedAt = (movedAtByPanId.get(a.id) ?? 0) - (movedAtByPanId.get(b.id) ?? 0);
        if (movedAt !== 0) return movedAt;
        return a.panId.localeCompare(b.panId);
      })
      .map((pan) => ({
        panUuid: pan.id,
        flavourId: item.flavourId,
        weightKg: allocationByPanId.get(pan.id) ?? 0,
        notes: "review: multiple active display pans; FIFO allocation applied",
      }));
  });

  return {
    items: inferredItems,
    panById: new Map([...panById, ...displayPans.map((pan): [string, Pan] => [pan.id, pan])]),
  };
}

export async function submitEodGelatoCount(input: EodCountInput): Promise<EodCountWithItems> {
  assertStoreLocation(input, input.locationId);

  const weightError = input.items
    .map((item) => validateGelatoPanWeightKg(item.weightKg, { fieldName: "EOD gelato weight", allowZero: true }))
    .find(Boolean);
  if (weightError) {
    throw new Error(weightError);
  }

  const existing = await findEodCount(input.locationId, input.businessDate);
  if (existing) {
    assertCanCorrectCount(input, input.businessDate);
  }

  const [displayPanRows, existingItems] = await Promise.all([
    listEodDisplayPanRows(input.locationId, input.businessDate),
    existing ? listEodItems(existing.id) : Promise.resolve([]),
  ]);
  const openingWeightByPanId = new Map(displayPanRows.map((row): [string, number] => [row.pan.id, row.openingWeightKg]));
  const displayPans = displayPanRows.map((row) => row.pan);
  const { items: normalizedItems, panById } = await normalizeEodItemsForLifecycle(
    input,
    displayPans,
    existingItems,
    openingWeightByPanId,
  );

  const count = existing
    ? await updateEodCount(existing.id, {
        status: "corrected",
        correctedBy: input.actorId,
        correctedAt: new Date().toISOString(),
        notes: input.notes,
      })
    : await createEodCount(input);

  const items = await replaceEodItems(count.id, normalizedItems);
  await finalizeEodDisplayPans(input, count.id, normalizedItems, panById);

  return { ...count, items };
}

async function finalizeEodDisplayPans(
  input: EodCountInput,
  countId: string,
  items: NormalizedEodItem[],
  panById: Map<string, Pan>,
) {
  await Promise.all(
    items
      .filter((item) => item.panUuid)
      .map(async (item) => {
        const pan = panById.get(item.panUuid!);
        if (!pan) return;

        if (!pan.active && pan.status === "closed" && item.weightKg <= 0) {
          return;
        }

        if (item.weightKg <= 0) {
          await recordPanEvent({
            panUuid: pan.id,
            eventType: "display_pan_depleted",
            fromLocationId: pan.currentLocationId,
            toLocationId: pan.currentLocationId,
            fromRole: pan.panRole,
            toRole: "store",
            weightKg: 0,
            recordedBy: input.actorId,
            metadata: { countId, businessDate: input.businessDate },
          });
          await updatePanState(pan.id, {
            currentWeightKg: 0,
            panRole: "store",
            status: "closed",
            active: false,
          });
          return;
        }

        await assertNoOtherOpenOrPartialPan(input.locationId, pan.flavourId, [pan.id]);

        if (pan.status === "returned") {
          const weightDelta = item.weightKg - (pan.currentWeightKg ?? 0);
          if (weightDelta !== 0) {
            await recordPanEvent({
              panUuid: pan.id,
              eventType: "display_pan_returned_to_deep_adjusted",
              fromLocationId: pan.currentLocationId,
              toLocationId: pan.currentLocationId,
              fromRole: pan.panRole,
              toRole: pan.panRole,
              weightKg: weightDelta,
              recordedBy: input.actorId,
              metadata: { countId, businessDate: input.businessDate },
            });
          }
        } else {
          await recordPanEvent({
            panUuid: pan.id,
            eventType: "display_pan_returned_to_deep",
            fromLocationId: pan.currentLocationId,
            toLocationId: pan.currentLocationId,
            fromRole: pan.panRole,
            toRole: "display",
            weightKg: item.weightKg,
            recordedBy: input.actorId,
            metadata: { countId, businessDate: input.businessDate },
          });
        }
        await updatePanState(pan.id, {
          currentWeightKg: item.weightKg,
          panRole: "display",
          status: "returned",
          active: true,
        });
      }),
  );
}

export async function listEmptyPanCountsByStore(locationId?: string): Promise<StoreEmptyPanCount[]> {
  if (isSupabaseConfigured) {
    const supabase = requireSupabaseClient();
    let query = supabase
      .from("store_empty_pan_counts")
      .select("location_id, empty_pan_count")
      .order("location_id");

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data, error } = await query;
    if (!error) {
      return data.map((row) => ({
        locationId: String(row.location_id),
        emptyPanCount: Number(row.empty_pan_count ?? 0),
      }));
    }
  }

  const counts = new Map<string, number>();
  const pans = await listAllPans();

  pans
    .filter((pan) => {
      if (!pan.currentLocationId) return false;
      if (locationId && pan.currentLocationId !== locationId) return false;

      return pan.status === "closed" && !pan.active && (pan.currentWeightKg ?? 0) <= 0;
    })
    .forEach((pan) => {
      counts.set(pan.currentLocationId!, (counts.get(pan.currentLocationId!) ?? 0) + 1);
    });

  demoEmptyPanReturns
    .filter((emptyReturn) => emptyReturn.status !== "cancelled" && (!locationId || emptyReturn.sourceLocationId === locationId))
    .forEach((emptyReturn) => {
      counts.set(emptyReturn.sourceLocationId, Math.max(0, (counts.get(emptyReturn.sourceLocationId) ?? 0) - emptyReturn.quantity));
    });

  return [...counts.entries()]
    .map(([countLocationId, emptyPanCount]) => ({ locationId: countLocationId, emptyPanCount }))
    .sort((a, b) => a.locationId.localeCompare(b.locationId));
}

async function getStoreEmptyPanCount(locationId: string): Promise<number> {
  return (await listEmptyPanCountsByStore(locationId)).find((count) => count.locationId === locationId)?.emptyPanCount ?? 0;
}

export async function createEmptyPanReturn(input: EmptyPanReturnInput): Promise<EmptyPanReturn> {
  assertStoreLocation(input, input.sourceLocationId);
  assertPositiveWholeQuantity(input.quantity, "Empty pan return quantity");

  const availableEmptyPans = await getStoreEmptyPanCount(input.sourceLocationId);
  if (input.quantity > availableEmptyPans) {
    throw new Error("Cannot return more empty pans than the app-calculated store empty-pan count.");
  }

  if (!isSupabaseConfigured) {
    const emptyReturn: EmptyPanReturn = {
      id: makeId("empty-return"),
      sourceLocationId: input.sourceLocationId,
      destinationLocationId: "lab",
      quantity: input.quantity,
      status: "in_transit",
      createdBy: input.actorId,
      sentAt: new Date().toISOString(),
      receivedBy: null,
      receivedAt: null,
      notes: input.notes,
      resolutionNotes: null,
    };
    demoEmptyPanReturns.push(emptyReturn);
    return emptyReturn;
  }

  const { data, error } = await requireSupabaseClient()
    .from("empty_pan_returns")
    .insert({
      source_location_id: input.sourceLocationId,
      destination_location_id: "lab",
      quantity: input.quantity,
      status: "in_transit",
      created_by: input.actorId,
      notes: input.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return mapEmptyPanReturn(data);
}

export async function listEmptyPanReturns(status?: EmptyPanReturnStatus): Promise<EmptyPanReturn[]> {
  if (!isSupabaseConfigured) {
    return demoEmptyPanReturns
      .filter((emptyReturn) => !status || emptyReturn.status === status)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }

  let query = requireSupabaseClient().from("empty_pan_returns").select("*").order("sent_at", { ascending: false });
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapEmptyPanReturn);
}

export async function acceptEmptyPanReturn(input: EmptyPanReturnResolutionInput): Promise<EmptyPanReturn> {
  assertLabOrAdmin(input);
  return updateEmptyPanReturnStatus(input, "accepted");
}

export async function disputeEmptyPanReturn(input: EmptyPanReturnResolutionInput): Promise<EmptyPanReturn> {
  assertLabOrAdmin(input);
  return updateEmptyPanReturnStatus(input, "disputed");
}

async function updateEmptyPanReturnStatus(
  input: EmptyPanReturnResolutionInput,
  status: Extract<EmptyPanReturnStatus, "accepted" | "disputed">,
): Promise<EmptyPanReturn> {
  if (!isSupabaseConfigured) {
    const existing = demoEmptyPanReturns.find((emptyReturn) => emptyReturn.id === input.returnId);
    if (!existing) throw new Error("Empty pan return not found.");
    if (existing.status !== "in_transit") {
      throw new Error("Only in-transit empty pan returns can be resolved.");
    }
    existing.status = status;
    existing.receivedBy = input.actorId;
    existing.receivedAt = new Date().toISOString();
    existing.resolutionNotes = input.notes;
    return { ...existing };
  }

  const { data, error } = await requireSupabaseClient()
    .from("empty_pan_returns")
    .update({
      status,
      received_by: input.actorId,
      received_at: new Date().toISOString(),
      resolution_notes: input.notes,
    })
    .eq("id", input.returnId)
    .eq("status", "in_transit")
    .select()
    .single();

  if (error) throw error;
  return mapEmptyPanReturn(data);
}

export async function submitPhysicalEmptyPanCount(input: EmptyPanPhysicalCountInput): Promise<EmptyPanPhysicalCount> {
  assertStoreLocation(input, input.locationId);
  assertNonnegativeWholeQuantity(input.physicalCount, "Physical empty pan count");

  const appCalculatedCount = await getStoreEmptyPanCount(input.locationId);
  const variance = input.physicalCount - appCalculatedCount;
  const status: EmptyPanPhysicalCount["status"] = variance === 0 ? "matched" : "flagged";

  if (!isSupabaseConfigured) {
    const count: EmptyPanPhysicalCount = {
      id: makeId("empty-physical-count"),
      locationId: input.locationId,
      businessDate: input.businessDate,
      countType: input.countType,
      physicalCount: input.physicalCount,
      appCalculatedCount,
      variance,
      status,
      countedBy: input.actorId,
      countedAt: new Date().toISOString(),
      resolvedBy: null,
      resolvedAt: null,
      notes: input.notes,
    };
    demoEmptyPanPhysicalCounts.push(count);
    return count;
  }

  const { data, error } = await requireSupabaseClient()
    .from("physical_empty_pan_counts")
    .insert({
      location_id: input.locationId,
      business_date: input.businessDate,
      count_type: input.countType,
      physical_count: input.physicalCount,
      app_calculated_count: appCalculatedCount,
      variance,
      status,
      counted_by: input.actorId,
      notes: input.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return mapEmptyPanPhysicalCount(data);
}

export async function listPhysicalEmptyPanCounts(locationId?: string): Promise<EmptyPanPhysicalCount[]> {
  if (!isSupabaseConfigured) {
    return demoEmptyPanPhysicalCounts
      .filter((count) => !locationId || count.locationId === locationId)
      .sort((a, b) => b.countedAt.localeCompare(a.countedAt));
  }

  let query = requireSupabaseClient()
    .from("physical_empty_pan_counts")
    .select("*")
    .order("counted_at", { ascending: false });
  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapEmptyPanPhysicalCount);
}

export async function resolvePhysicalEmptyPanCount(input: EmptyPanPhysicalCountResolutionInput): Promise<EmptyPanPhysicalCount> {
  const existing = (await listPhysicalEmptyPanCounts()).find((count) => count.id === input.countId);
  if (!existing) {
    throw new Error("Physical empty pan count not found.");
  }
  assertCanResolveStoreReview(input, existing.locationId);

  if (!isSupabaseConfigured) {
    existing.status = "resolved";
    existing.resolvedBy = input.actorId;
    existing.resolvedAt = new Date().toISOString();
    existing.notes = input.notes ?? existing.notes;
    return { ...existing };
  }

  const { data, error } = await requireSupabaseClient()
    .from("physical_empty_pan_counts")
    .update({
      status: "resolved",
      resolved_by: input.actorId,
      resolved_at: new Date().toISOString(),
      notes: input.notes,
    })
    .eq("id", input.countId)
    .select()
    .single();

  if (error) throw error;
  return mapEmptyPanPhysicalCount(data);
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
