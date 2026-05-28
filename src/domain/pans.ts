export type PanRole = "store" | "backup" | "display" | "event";
export type PanStatus = "available" | "in_transit" | "received" | "display" | "reserved" | "returned" | "closed";

export interface GelatoBatch {
  id: string;
  batchCode: string;
  flavourId: string;
  productionDate: string;
  producedBy: string | null;
  notes: string | null;
}

export interface Pan {
  id: string;
  panId: string;
  batchId: string;
  flavourId: string;
  currentLocationId: string | null;
  panRole: PanRole;
  status: PanStatus;
  fullWeightKg: number | null;
  currentWeightKg: number | null;
  producedAt: string;
  active: boolean;
}

export interface PanEvent {
  id: string;
  panUuid: string;
  eventType: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  fromRole: PanRole | null;
  toRole: PanRole | null;
  weightKg: number | null;
  recordedBy: string | null;
  recordedAt: string;
  metadata: Record<string, unknown>;
}

export function isActiveDisplayAssignment(pan: Pan): boolean {
  return pan.active && pan.panRole === "display" && (pan.status === "display" || pan.status === "returned");
}

export function isDeepFreezerPan(pan: Pan): boolean {
  if (!pan.active) return false;
  if (pan.panRole === "backup" && (pan.status === "received" || pan.status === "returned")) return true;
  return pan.panRole === "display" && pan.status === "returned";
}

export function isPartialDeepFreezerPan(pan: Pan): boolean {
  return pan.status === "returned";
}

export function buildPanId(shortCode: string, productionDate: string, sequence: number): string {
  const numericDate = productionDate.replace(/-/g, "");
  return `${shortCode.toUpperCase()}-${numericDate}-${String(sequence).padStart(2, "0")}`;
}
