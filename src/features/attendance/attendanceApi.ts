import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import { calculateHours, getTodayKey, type AttendanceEntry } from "../../domain/attendance";
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
  };
}

export function resetDemoAttendanceData() {
  demoAttendance = [];
}

export async function getTodayAttendance(userId: string, date = getTodayKey()): Promise<AttendanceEntry | null> {
  if (!isSupabaseConfigured) {
    return demoAttendance.find((entry) => entry.userId === userId && entry.workDate === date) ?? null;
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("work_date", date)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapAttendanceRow(data) : null;
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

export async function checkIn(profile: StaffProfile, locationId: string | null, now = new Date()): Promise<AttendanceEntry> {
  if (!locationId) {
    throw new Error("Work location is required.");
  }

  const workDate = getTodayKey(now);
  const existing = await getTodayAttendance(profile.id, workDate);

  if (existing) {
    throw new Error("Attendance is already started for today.");
  }

  if (!isSupabaseConfigured) {
    const created: AttendanceEntry = {
      id: `attendance-${Date.now()}`,
      userId: profile.id,
      locationId,
      workDate,
      checkInAt: now.toISOString(),
      checkOutAt: null,
      hours: null,
      status: "active",
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
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapAttendanceRow(data);
}

export async function checkOut(entry: AttendanceEntry, now = new Date()): Promise<AttendanceEntry> {
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
    return { ...existing };
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_entries")
    .update({
      check_out_at: checkOutAt,
      hours,
      status: "checked_out",
    })
    .eq("id", entry.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapAttendanceRow(data);
}
