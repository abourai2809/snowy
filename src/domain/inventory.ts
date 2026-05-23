export type FillState = "full" | "partial";
export type ReceiptStatus = "accepted" | "rejected";
export type CountStatus = "draft" | "submitted" | "corrected";

export interface StoreReceipt {
  id: string;
  dispatchId: string;
  locationId: string;
  status: ReceiptStatus;
  receivedBy: string | null;
  receivedAt: string;
  notes: string | null;
}

export interface DisplayMovement {
  id: string;
  panId: string;
  storeLocationId: string;
  fillState: FillState;
  weightKg: number | null;
  movedBy: string | null;
  movedAt: string;
}

export interface EodCount {
  id: string;
  locationId: string;
  businessDate: string;
  status: CountStatus;
  submittedBy: string | null;
  submittedAt: string;
  correctedBy: string | null;
  correctedAt: string | null;
  notes: string | null;
}

export interface EodCountItem {
  id: string;
  countId: string;
  panId: string | null;
  flavourId: string | null;
  catalogItemId: string | null;
  quantity: number | null;
  weightKg: number | null;
  unit: string | null;
  notes: string | null;
}
