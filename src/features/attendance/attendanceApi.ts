import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import {
  calculateHours,
  getTodayKey,
  isCheckedOut,
  type AttendanceEntry,
  type AttendanceLocationEvidence,
} from "../../domain/attendance";
import type { StaffProfile } from "../../domain/roles";

let demoAttendance: AttendanceEntry[] = [];

function mapAttendanceRow(row: Record<string, unknown>): AttendanceEntry {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    locationId: row.location_id ? String(row.location_id) : null,
    workDate: String(row.work_date),
    checkInAt: String(row.check_in_at),
    checkOutAt: row.check_out_at ? String(row.check_out_at) : null,
    hours: row.hours === null || row.hours === undefined ? null : Number(row.hours),
    status: row.status as AttendanceEntry["status"],
    checkInLocation: mapLocationEvidence(row, "check_in"),
    checkOutLocation: mapLocationEvidence(row, "check_out"),
  };
}

function mapLocationEvidence(row: Record<string, unknown>, prefix: "check_in" | "check_out"): AttendanceLocationEvidence | null {
  const status = row[`${prefix}_location_status`];
  const latitude = row[`${prefix}_latitude`];
  const longitude = row[`${prefix}_longitude`];
  const accuracyM = row[`${prefix}_accuracy_m`];
  const distanceM = row[`${prefix}_distance_m`];
  const validationLocationId = row[`${prefix}_validation_location_id`];
  const error = row[`${prefix}_location_error`];

  if (!status && latitude === undefined && longitude === undefined && accuracyM === undefined && distanceM === undefined) {
    return null;
  }

  return {
    latitude: latitude === null || latitude === undefined ? null : Number(latitude),
    longitude: longitude === null || longitude === undefined ? null : Number(longitude),
    accuracyM: accuracyM === null || accuracyM === undefined ? null : Number(accuracyM),
    distanceM: distanceM === null || distanceM === undefined ? null : Number(distanceM),
    validationLocationId: validationLocationId ? String(validationLocationId) : null,
    status: (status ?? "unknown_error") as AttendanceLocationEvidence["status"],
    error: error ? String(error) : null,
  };
}

function buildLocationColumns(prefix: "check_in" | "check_out", evidence?: AttendanceLocationEvidence | null) {
  if (!evidence) {
    return {};
  }

  return {
    [`${prefix}_latitude`]: evidence.latitude,
    [`${prefix}_longitude`]: evidence.longitude,
    [`${prefix}_accuracy_m`]: evidence.accuracyM,
    [`${prefix}_distance_m`]: evidence.distanceM,
    [`${prefix}_validation_location_id`]: evidence.validationLocationId,
    [`${prefix}_location_status`]: evidence.status,
    [`${prefix}_location_error`]: evidence.error,
  };
}

export function resetDemoAttendanceData() {
  demoAttendance = [];
}

function sortAttendance(entries: AttendanceEntry[]): AttendanceEntry[] {
  return [...entries].sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
}

export async function listTodayAttendanceForUser(userId: string, date = getTodayKey()): Promise<AttendanceEntry[]> {
  if (!isSupabaseConfigured) {
    return sortAttendance(demoAttendance.filter((entry) => entry.userId === userId && entry.workDate === date));
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("work_date", date)
    .order("check_in_at");

  if (error) {
    throw error;
  }

  return data.map(mapAttendanceRow);
}

export async function getActiveAttendance(userId: string, date = getTodayKey()): Promise<AttendanceEntry | null> {
  const entries = await listTodayAttendanceForUser(userId, date);
  return entries.find((entry) => !isCheckedOut(entry)) ?? null;
}

export async function getTodayAttendance(userId: string, date = getTodayKey()): Promise<AttendanceEntry | null> {
  const entries = await listTodayAttendanceForUser(userId, date);
  return entries.find((entry) => !isCheckedOut(entry)) ?? entries.at(-1) ?? null;
}

export async function listAttendanceForDate(date = getTodayKey()): Promise<AttendanceEntry[]> {
  if (!isSupabaseConfigured) {
    return [...demoAttendance.filter((entry) => entry.workDate === date)];
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_entries")
    .select("*")
    .eq("work_date", date)
    .order("check_in_at");

  if (error) {
    throw error;
  }

  return data.map(mapAttendanceRow);
}

export async function checkIn(
  profile: StaffProfile,
  locationId: string | null,
  now = new Date(),
  locationEvidence?: AttendanceLocationEvidence | null,
): Promise<AttendanceEntry> {
  if (!locationId) {
    throw new Error("Work location is required.");
  }

  const workDate = getTodayKey(now);
  const existing = await getActiveAttendance(profile.id, workDate);

  if (existing) {
    throw new Error("Attendance is already active. Check out before starting another shift.");
  }

  if (!isSupabaseConfigured) {
    const created: AttendanceEntry = {
      id: `attendance-${Date.now()}-${demoAttendance.length}`,
      userId: profile.id,
      locationId,
      workDate,
      checkInAt: now.toISOString(),
      checkOutAt: null,
      hours: null,
      status: "active",
      checkInLocation: locationEvidence ?? null,
      checkOutLocation: null,
    };
    demoAttendance.push(created);
    return created;
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_entries")
    .insert({
      user_id: profile.id,
      location_id: locationId,
      work_date: workDate,
      check_in_at: now.toISOString(),
      status: "active",
      ...buildLocationColumns("check_in", locationEvidence),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapAttendanceRow(data);
}

export async function checkOut(
  entry: AttendanceEntry,
  now = new Date(),
  locationEvidence?: AttendanceLocationEvidence | null,
): Promise<AttendanceEntry> {
  if (entry.checkOutAt) {
    throw new Error("Attendance is already checked out for today.");
  }

  const checkOutAt = now.toISOString();
  const hours = calculateHours(entry.checkInAt, checkOutAt);

  if (!isSupabaseConfigured) {
    const existing = demoAttendance.find((item) => item.id === entry.id);
    if (!existing) {
      throw new Error("Attendance entry not found.");
    }

    existing.checkOutAt = checkOutAt;
    existing.hours = hours;
    existing.status = "checked_out";
    existing.checkOutLocation = locationEvidence ?? null;
    return { ...existing };
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_entries")
    .update({
      check_out_at: checkOutAt,
      hours,
      status: "checked_out",
      ...buildLocationColumns("check_out", locationEvidence),
    })
    .eq("id", entry.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapAttendanceRow(data);
}
