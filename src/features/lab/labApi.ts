import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import type { Dispatch, DispatchItem } from "../../domain/dispatches";
import { buildPanId, type GelatoBatch, type Pan } from "../../domain/pans";
import type { Flavour } from "../../domain/flavours";

export interface ProductionInput {
  flavour: Flavour;
  productionDate: string;
  panCount: number;
  fullWeightKg: number;
  notes: string | null;
  producedBy: string | null;
}

export interface ProductionResult {
  batch: GelatoBatch;
  pans: Pan[];
}

export interface DispatchInput {
  panUuids: string[];
  toLocationId: string;
  dispatchedBy: string | null;
  notes: string | null;
}

const labLocationId = "lab";
let demoBatches: GelatoBatch[] = [];
let demoPans: Pan[] = [];
let demoDispatches: Dispatch[] = [];
let demoDispatchItems: DispatchItem[] = [];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapBatch(row: Record<string, unknown>): GelatoBatch {
  return {
    id: String(row.id),
    batchCode: String(row.batch_code),
    flavourId: String(row.flavour_id),
    productionDate: String(row.production_date),
    producedBy: row.produced_by ? String(row.produced_by) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

function mapPan(row: Record<string, unknown>): Pan {
  return {
    id: String(row.id),
    panId: String(row.pan_id),
    batchId: row.batch_id ? String(row.batch_id) : "",
    flavourId: String(row.flavour_id),
    currentLocationId: row.current_location_id ? String(row.current_location_id) : null,
    panRole: row.pan_role as Pan["panRole"],
    status: row.status as Pan["status"],
    fullWeightKg: row.full_weight_kg === null || row.full_weight_kg === undefined ? null : Number(row.full_weight_kg),
    currentWeightKg: row.current_weight_kg === null || row.current_weight_kg === undefined ? null : Number(row.current_weight_kg),
    producedAt: String(row.produced_at),
    active: Boolean(row.active),
  };
}

function mapDispatch(row: Record<string, unknown>): Dispatch {
  return {
    id: String(row.id),
    dispatchCode: String(row.dispatch_code),
    fromLocationId: String(row.from_location_id),
    toLocationId: String(row.to_location_id),
    status: row.status as Dispatch["status"],
    dispatchedBy: row.dispatched_by ? String(row.dispatched_by) : null,
    dispatchedAt: String(row.dispatched_at),
    notes: row.notes ? String(row.notes) : null,
  };
}

export function resetDemoLabData() {
  demoBatches = [];
  demoPans = [];
  demoDispatches = [];
  demoDispatchItems = [];
}

function nextSequenceFromPanIds(shortCode: string, productionDate: string, panIds: string[]): number {
  const prefix = `${shortCode.toUpperCase()}-${productionDate.replace(/-/g, "")}-`;
  const existingSequences = panIds
    .filter((panId) => panId.startsWith(prefix))
    .map((panId) => Number(panId.slice(prefix.length)))
    .filter((sequence) => Number.isFinite(sequence));

  return existingSequences.length ? Math.max(...existingSequences) + 1 : 1;
}

function nextDemoSequenceFor(shortCode: string, productionDate: string): number {
  return nextSequenceFromPanIds(shortCode, productionDate, demoPans.map((pan) => pan.panId));
}

function createBatchCode(shortCode: string, productionDate: string): string {
  const base = `${shortCode.toUpperCase()}-${productionDate.replace(/-/g, "")}`;
  const count = demoBatches.filter((batch) => batch.batchCode.startsWith(base)).length;
  return count ? `${base}-${count + 1}` : base;
}

export async function createProduction(input: ProductionInput): Promise<ProductionResult> {
  if (input.panCount < 1) {
    throw new Error("Pan count must be at least 1.");
  }

  if (!isSupabaseConfigured) {
    const batch: GelatoBatch = {
      id: makeId("batch"),
      batchCode: createBatchCode(input.flavour.shortCode, input.productionDate),
      flavourId: input.flavour.id,
      productionDate: input.productionDate,
      producedBy: input.producedBy,
      notes: input.notes,
    };

    const startSequence = nextDemoSequenceFor(input.flavour.shortCode, input.productionDate);
    const pans = Array.from({ length: input.panCount }, (_, index): Pan => ({
      id: makeId("pan"),
      panId: buildPanId(input.flavour.shortCode, input.productionDate, startSequence + index),
      batchId: batch.id,
      flavourId: input.flavour.id,
      currentLocationId: labLocationId,
      panRole: "backup",
      status: "available",
      fullWeightKg: input.fullWeightKg,
      currentWeightKg: input.fullWeightKg,
      producedAt: new Date(`${input.productionDate}T09:00:00`).toISOString(),
      active: true,
    }));

    demoBatches.push(batch);
    demoPans.push(...pans);
    return { batch, pans };
  }

  const supabase = requireSupabaseClient();
  const panPrefix = `${input.flavour.shortCode.toUpperCase()}-${input.productionDate.replace(/-/g, "")}-`;
  const { data: existingPanRows, error: existingPanError } = await supabase
    .from("pans")
    .select("pan_id")
    .like("pan_id", `${panPrefix}%`);

  if (existingPanError) throw existingPanError;

  const startSequence = nextSequenceFromPanIds(
    input.flavour.shortCode,
    input.productionDate,
    existingPanRows.map((row) => String(row.pan_id)),
  );

  const batchCode = `${input.flavour.shortCode}-${input.productionDate.replace(/-/g, "")}-${Date.now()}`;
  const { data: batchRow, error: batchError } = await supabase
    .from("gelato_batches")
    .insert({
      batch_code: batchCode,
      flavour_id: input.flavour.id,
      production_date: input.productionDate,
      produced_by: input.producedBy,
      notes: input.notes,
    })
    .select()
    .single();

  if (batchError) throw batchError;

  const pansPayload = Array.from({ length: input.panCount }, (_, index) => ({
    pan_id: buildPanId(input.flavour.shortCode, input.productionDate, startSequence + index),
    batch_id: batchRow.id,
    flavour_id: input.flavour.id,
    current_location_id: labLocationId,
    pan_role: "backup",
    status: "available",
    full_weight_kg: input.fullWeightKg,
    current_weight_kg: input.fullWeightKg,
  }));

  const { data: panRows, error: panError } = await supabase.from("pans").insert(pansPayload).select();
  if (panError) throw panError;

  return { batch: mapBatch(batchRow), pans: panRows.map(mapPan) };
}

export async function listLabPans(): Promise<Pan[]> {
  if (!isSupabaseConfigured) {
    return [...demoPans];
  }

  const { data, error } = await requireSupabaseClient()
    .from("pans")
    .select("*")
    .eq("current_location_id", labLocationId)
    .order("produced_at", { ascending: false });

  if (error) throw error;
  return data.map(mapPan);
}

export async function listAvailableLabPans(): Promise<Pan[]> {
  const pans = await listLabPans();
  return pans.filter((pan) => pan.status === "available" && pan.active);
}

export async function listLabDispatches(): Promise<Dispatch[]> {
  if (!isSupabaseConfigured) {
    return [...demoDispatches];
  }

  const { data, error } = await requireSupabaseClient()
    .from("dispatches")
    .select("*")
    .eq("from_location_id", labLocationId)
    .order("dispatched_at", { ascending: false });

  if (error) throw error;
  return data.map(mapDispatch);
}

export async function createDispatch(input: DispatchInput): Promise<Dispatch> {
  if (input.panUuids.length === 0) {
    throw new Error("Select at least one pan to dispatch.");
  }

  if (!isSupabaseConfigured) {
    const selected = demoPans.filter((pan) => input.panUuids.includes(pan.id));
    if (selected.length !== input.panUuids.length) {
      throw new Error("One or more pans were not found.");
    }
    if (selected.some((pan) => pan.status !== "available")) {
      throw new Error("Only available lab pans can be dispatched.");
    }

    const dispatch: Dispatch = {
      id: makeId("dispatch"),
      dispatchCode: `DSP-${Date.now()}`,
      fromLocationId: labLocationId,
      toLocationId: input.toLocationId,
      status: "in_transit",
      dispatchedBy: input.dispatchedBy,
      dispatchedAt: new Date().toISOString(),
      notes: input.notes,
    };

    const items = selected.map((pan): DispatchItem => ({
      id: makeId("dispatch-item"),
      dispatchId: dispatch.id,
      panId: pan.id,
      plannedWeightKg: pan.currentWeightKg,
    }));

    selected.forEach((pan) => {
      pan.status = "in_transit";
      pan.panRole = "store";
      pan.currentLocationId = input.toLocationId;
    });
    demoDispatches.push(dispatch);
    demoDispatchItems.push(...items);
    return dispatch;
  }

  const supabase = requireSupabaseClient();
  const { data: selected, error: panLookupError } = await supabase
    .from("pans")
    .select("*")
    .in("id", input.panUuids);

  if (panLookupError) throw panLookupError;
  if (selected.some((pan) => pan.status !== "available")) {
    throw new Error("Only available lab pans can be dispatched.");
  }

  const { data: dispatchRow, error: dispatchError } = await supabase
    .from("dispatches")
    .insert({
      dispatch_code: `DSP-${Date.now()}`,
      from_location_id: labLocationId,
      to_location_id: input.toLocationId,
      status: "in_transit",
      dispatched_by: input.dispatchedBy,
      notes: input.notes,
    })
    .select()
    .single();

  if (dispatchError) throw dispatchError;

  const { error: itemError } = await supabase.from("dispatch_items").insert(
    selected.map((pan) => ({
      dispatch_id: dispatchRow.id,
      pan_uuid: pan.id,
      planned_weight_kg: pan.current_weight_kg,
    })),
  );

  if (itemError) throw itemError;

  const { error: panUpdateError } = await supabase
    .from("pans")
    .update({ status: "in_transit", pan_role: "store", current_location_id: input.toLocationId })
    .in("id", input.panUuids);

  if (panUpdateError) throw panUpdateError;
  return mapDispatch(dispatchRow);
}
