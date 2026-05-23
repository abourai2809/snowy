export type DispatchStatus = "pending" | "in_transit" | "received" | "cancelled";

export interface Dispatch {
  id: string;
  dispatchCode: string;
  fromLocationId: string;
  toLocationId: string;
  status: DispatchStatus;
  dispatchedBy: string | null;
  dispatchedAt: string;
  notes: string | null;
}

export interface DispatchItem {
  id: string;
  dispatchId: string;
  panId: string;
  plannedWeightKg: number | null;
}
