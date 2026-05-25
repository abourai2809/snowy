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

export interface DeepFreezerCount {
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

export interface DeepFreezerCountItem {
  id: string;
  countId: string;
  flavourId: string;
  flavourName: string;
  weightKg: number;
  unit: "kg";
  notes: string | null;
}

export interface DeepFreezerCountWithItems extends DeepFreezerCount {
  items: DeepFreezerCountItem[];
}

export interface StoreFlavourTarget {
  id: string;
  locationId: string;
  flavourId: string;
  targetWeightKg: number;
  active: boolean;
}

export interface DeepFreezerBalance {
  locationId: string;
  flavourId: string;
  flavourName: string;
  baseWeightKg: number;
  receivedWeightKg: number;
  displayMovedWeightKg: number;
  currentWeightKg: number;
  sourceCountId: string | null;
  sourceBusinessDate: string | null;
}

export interface StoreGelatoRequirement {
  id: string;
  locationId: string;
  locationName: string;
  flavourId: string;
  flavourName: string;
  currentWeightKg: number;
  targetWeightKg: number;
  neededWeightKg: number;
}
