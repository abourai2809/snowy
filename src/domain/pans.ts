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

export function buildPanId(shortCode: string, productionDate: string, sequence: number): string {
  const numericDate = productionDate.replace(/-/g, "");
  return `${shortCode.toUpperCase()}-${numericDate}-${String(sequence).padStart(2, "0")}`;
}
