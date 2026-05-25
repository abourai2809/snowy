export type UrgentRequirementType =
  | "gelato"
  | "store_supply"
  | "packaging"
  | "maintenance"
  | "other";

export type UrgentRequirementStatus =
  | "submitted"
  | "acknowledged"
  | "in_progress"
  | "fulfilled"
  | "cancelled";

export type UrgentRequirementPriority = "urgent" | "high" | "normal";

export interface UrgentRequirement {
  id: string;
  sourceLocationId: string;
  requirementType: UrgentRequirementType;
  relatedFlavourId: string | null;
  relatedCatalogItemId: string | null;
  quantity: number | null;
  unit: string | null;
  priority: UrgentRequirementPriority;
  message: string;
  status: UrgentRequirementStatus;
  createdBy: string | null;
  createdAt: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  fulfilledBy: string | null;
  fulfilledAt: string | null;
}

export interface UrgentRequirementEvent {
  id: string;
  requirementId: string;
  eventType: string;
  status: UrgentRequirementStatus;
  message: string | null;
  actorId: string | null;
  createdAt: string;
}

export const ACTIVE_URGENT_REQUIREMENT_STATUSES: UrgentRequirementStatus[] = [
  "submitted",
  "acknowledged",
  "in_progress",
];

export const URGENT_REQUIREMENT_TYPE_LABELS: Record<UrgentRequirementType, string> = {
  gelato: "Gelato",
  store_supply: "Store supply",
  packaging: "Packaging",
  maintenance: "Maintenance",
  other: "Other",
};
