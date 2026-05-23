export type AttendanceStatus = "active" | "checked_out" | "corrected" | "void";

export interface AttendanceEntry {
  id: string;
  userId: string;
  locationId: string | null;
  workDate: string;
  checkInAt: string;
  checkOutAt: string | null;
  hours: number | null;
  status: AttendanceStatus;
}

export function getTodayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function calculateHours(checkInAt: string, checkOutAt: string): number {
  const ms = new Date(checkOutAt).getTime() - new Date(checkInAt).getTime();
  return Math.max(0, Math.round((ms / 36_000) / 10));
}

export function isCheckedOut(entry: AttendanceEntry | null): boolean {
  return Boolean(entry?.checkOutAt);
}
