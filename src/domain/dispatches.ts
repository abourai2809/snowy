export type DispatchStatus = "draft" | "pending" | "accepted" | "partially_accepted" | "rejected" | "cancelled";

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
