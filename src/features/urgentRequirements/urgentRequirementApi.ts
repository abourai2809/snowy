import type {
  UrgentRequirement,
  UrgentRequirementEvent,
  UrgentRequirementPriority,
  UrgentRequirementStatus,
  UrgentRequirementType,
} from "../../domain/urgentRequirements";
import { ACTIVE_URGENT_REQUIREMENT_STATUSES } from "../../domain/urgentRequirements";
import { isLabRole, isStoreRole, type AppRole } from "../../domain/roles";
import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import type { StoreActor } from "../store/storeApi";

export interface UrgentRequirementInput extends StoreActor {
  sourceLocationId: string;
  requirementType: UrgentRequirementType;
  relatedFlavourId: string | null;
  relatedCatalogItemId: string | null;
  quantity: number | null;
  unit: string | null;
  priority: UrgentRequirementPriority;
  message: string;
}

export interface UrgentRequirementStatusInput {
  requirementId: string;
  status: UrgentRequirementStatus;
  actorId: string | null;
  actorRole: AppRole;
  message?: string | null;
}

let demoRequirements: UrgentRequirement[] = [];
let demoEvents: UrgentRequirementEvent[] = [];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapRequirement(row: Record<string, unknown>): UrgentRequirement {
  return {
    id: String(row.id),
    sourceLocationId: String(row.source_location_id),
    requirementType: row.requirement_type as UrgentRequirementType,
    relatedFlavourId: row.related_flavour_id ? String(row.related_flavour_id) : null,
    relatedCatalogItemId: row.related_catalog_item_id ? String(row.related_catalog_item_id) : null,
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    unit: row.unit ? String(row.unit) : null,
    priority: row.priority as UrgentRequirementPriority,
    message: String(row.message),
    status: row.status as UrgentRequirementStatus,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    acknowledgedBy: row.acknowledged_by ? String(row.acknowledged_by) : null,
    acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : null,
    fulfilledBy: row.fulfilled_by ? String(row.fulfilled_by) : null,
    fulfilledAt: row.fulfilled_at ? String(row.fulfilled_at) : null,
  };
}

function mapEvent(row: Record<string, unknown>): UrgentRequirementEvent {
  return {
    id: String(row.id),
    requirementId: String(row.urgent_requirement_id),
    eventType: String(row.event_type),
    status: row.status as UrgentRequirementStatus,
    message: row.message ? String(row.message) : null,
    actorId: row.actor_id ? String(row.actor_id) : null,
    createdAt: String(row.created_at),
  };
}

function assertCanCreate(input: UrgentRequirementInput) {
  if (input.actorRole !== "admin" && !isStoreRole(input.actorRole)) {
    throw new Error("Only store roles can create urgent requirements.");
  }

  if (input.actorRole !== "admin" && input.actorLocationId !== input.sourceLocationId) {
    throw new Error("Store users can only create urgent requirements for their active store.");
  }

  if (!input.message.trim()) {
    throw new Error("Urgent requirement details are required.");
  }
}

function assertCanUpdate(actorRole: AppRole) {
  if (!["admin", "store_manager", "lab_manager"].includes(actorRole)) {
    throw new Error("Only Admin or managers can update urgent requirement status.");
  }
}

function canSeeRequirement(requirement: UrgentRequirement, viewerRole: AppRole, viewerLocationId: string | null) {
  if (viewerRole === "admin" || isLabRole(viewerRole)) {
    return true;
  }

  if (!isStoreRole(viewerRole)) {
    return false;
  }

  return viewerLocationId === "rajpur" || requirement.sourceLocationId === viewerLocationId;
}

function isActive(requirement: UrgentRequirement): boolean {
  return ACTIVE_URGENT_REQUIREMENT_STATUSES.includes(requirement.status);
}

export function resetDemoUrgentRequirementData() {
  demoRequirements = [];
  demoEvents = [];
}

export async function createUrgentRequirement(input: UrgentRequirementInput): Promise<UrgentRequirement> {
  assertCanCreate(input);

  if (!isSupabaseConfigured) {
    const requirement: UrgentRequirement = {
      id: makeId("urgent"),
      sourceLocationId: input.sourceLocationId,
      requirementType: input.requirementType,
      relatedFlavourId: input.relatedFlavourId,
      relatedCatalogItemId: input.relatedCatalogItemId,
      quantity: input.quantity,
      unit: input.unit,
      priority: input.priority,
      message: input.message.trim(),
      status: "submitted",
      createdBy: input.actorId,
      createdAt: new Date().toISOString(),
      acknowledgedBy: null,
      acknowledgedAt: null,
      fulfilledBy: null,
      fulfilledAt: null,
    };
    demoRequirements.push(requirement);
    demoEvents.push({
      id: makeId("urgent-event"),
      requirementId: requirement.id,
      eventType: "created",
      status: requirement.status,
      message: null,
      actorId: input.actorId,
      createdAt: requirement.createdAt,
    });
    return requirement;
  }

  const { data, error } = await requireSupabaseClient()
    .from("urgent_requirements")
    .insert({
      source_location_id: input.sourceLocationId,
      requirement_type: input.requirementType,
      related_flavour_id: input.relatedFlavourId,
      related_catalog_item_id: input.relatedCatalogItemId,
      quantity: input.quantity,
      unit: input.unit,
      priority: input.priority,
      message: input.message.trim(),
      status: "submitted",
      created_by: input.actorId,
    })
    .select()
    .single();

  if (error) throw error;
  const requirement = mapRequirement(data);
  await createUrgentRequirementEvent(requirement.id, "created", requirement.status, input.actorId, null);
  return requirement;
}

export async function listVisibleUrgentRequirements(
  viewerRole: AppRole,
  viewerLocationId: string | null,
): Promise<UrgentRequirement[]> {
  if (!isSupabaseConfigured) {
    return demoRequirements
      .filter((requirement) => isActive(requirement) && canSeeRequirement(requirement, viewerRole, viewerLocationId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const { data, error } = await requireSupabaseClient()
    .from("urgent_requirements")
    .select("*")
    .in("status", ACTIVE_URGENT_REQUIREMENT_STATUSES)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(mapRequirement).filter((requirement) => canSeeRequirement(requirement, viewerRole, viewerLocationId));
}

export async function updateUrgentRequirementStatus(
  input: UrgentRequirementStatusInput,
): Promise<UrgentRequirement> {
  assertCanUpdate(input.actorRole);

  const timestamp = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: timestamp,
  };

  if (input.status === "acknowledged") {
    patch.acknowledged_by = input.actorId;
    patch.acknowledged_at = timestamp;
  }

  if (input.status === "fulfilled" || input.status === "cancelled") {
    patch.fulfilled_by = input.actorId;
    patch.fulfilled_at = timestamp;
  }

  if (!isSupabaseConfigured) {
    const existing = demoRequirements.find((requirement) => requirement.id === input.requirementId);
    if (!existing) {
      throw new Error("Urgent requirement not found.");
    }

    existing.status = input.status;
    if (input.status === "acknowledged") {
      existing.acknowledgedBy = input.actorId;
      existing.acknowledgedAt = timestamp;
    }
    if (input.status === "fulfilled" || input.status === "cancelled") {
      existing.fulfilledBy = input.actorId;
      existing.fulfilledAt = timestamp;
    }
    demoEvents.push({
      id: makeId("urgent-event"),
      requirementId: existing.id,
      eventType: "status_changed",
      status: input.status,
      message: input.message ?? null,
      actorId: input.actorId,
      createdAt: timestamp,
    });
    return { ...existing };
  }

  const { data, error } = await requireSupabaseClient()
    .from("urgent_requirements")
    .update(patch)
    .eq("id", input.requirementId)
    .select()
    .single();

  if (error) throw error;
  const requirement = mapRequirement(data);
  await createUrgentRequirementEvent(requirement.id, "status_changed", requirement.status, input.actorId, input.message ?? null);
  return requirement;
}

export async function listUrgentRequirementEvents(requirementId: string): Promise<UrgentRequirementEvent[]> {
  if (!isSupabaseConfigured) {
    return demoEvents.filter((event) => event.requirementId === requirementId);
  }

  const { data, error } = await requireSupabaseClient()
    .from("urgent_requirement_events")
    .select("*")
    .eq("urgent_requirement_id", requirementId)
    .order("created_at");

  if (error) throw error;
  return data.map(mapEvent);
}

async function createUrgentRequirementEvent(
  requirementId: string,
  eventType: string,
  status: UrgentRequirementStatus,
  actorId: string | null,
  message: string | null,
) {
  const { error } = await requireSupabaseClient().from("urgent_requirement_events").insert({
    urgent_requirement_id: requirementId,
    event_type: eventType,
    status,
    actor_id: actorId,
    message,
  });

  if (error) throw error;
}
