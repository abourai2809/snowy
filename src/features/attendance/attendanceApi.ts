import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";
import {
  calculateHours,
  getTodayKey,
  isCheckedOut,
  type AttendanceEntry,
  type AttendanceLocationEvidence,
  type AttendanceLocationSegment,
  type AttendanceSelfieCheck,
  type AttendanceSelfieReview,
} from "../../domain/attendance";
import type { StaffProfile } from "../../domain/roles";

let demoAttendance: AttendanceEntry[] = [];
let demoLocationSegments: AttendanceLocationSegment[] = [];
let demoSelfieChecks: AttendanceSelfieCheck[] = [];

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
    selfieInUrl: row.selfie_in_url ? String(row.selfie_in_url) : null,
    selfieOutUrl: row.selfie_out_url ? String(row.selfie_out_url) : null,
  };
}

function mapSelfieCheckRow(row: Record<string, unknown>): AttendanceSelfieCheck {
  return {
    id: String(row.id),
    attendanceEntryId: String(row.attendance_entry_id),
    selfieKind: row.selfie_kind as AttendanceSelfieCheck["selfieKind"],
    selfiePath: String(row.selfie_path),
    status: row.status as AttendanceSelfieCheck["status"],
    overallStatus: row.overall_status ? (row.overall_status as AttendanceSelfieCheck["overallStatus"]) : null,
    apronStatus: row.apron_status ? (row.apron_status as AttendanceSelfieCheck["apronStatus"]) : null,
    headwearStatus: row.headwear_status ? (row.headwear_status as AttendanceSelfieCheck["headwearStatus"]) : null,
    gloveThumbsUpStatus: row.glove_thumbs_up_status
      ? (row.glove_thumbs_up_status as AttendanceSelfieCheck["gloveThumbsUpStatus"])
      : null,
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    model: row.model ? String(row.model) : null,
    notes: row.notes ? String(row.notes) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    checkedAt: row.checked_at ? String(row.checked_at) : null,
    archiveProvider: row.archive_provider ? String(row.archive_provider) : null,
    archivePath: row.archive_path ? String(row.archive_path) : null,
    archiveFileId: row.archive_file_id ? String(row.archive_file_id) : null,
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    storageDeletedAt: row.storage_deleted_at ? String(row.storage_deleted_at) : null,
    archiveError: row.archive_error ? String(row.archive_error) : null,
    createdAt: String(row.created_at),
  };
}

function mapLocationSegmentRow(row: Record<string, unknown>): AttendanceLocationSegment {
  return {
    id: String(row.id),
    attendanceEntryId: String(row.attendance_entry_id),
    userId: String(row.user_id),
    locationId: String(row.location_id),
    workDate: String(row.work_date),
    checkInAt: String(row.check_in_at),
    checkOutAt: row.check_out_at ? String(row.check_out_at) : null,
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
  demoLocationSegments = [];
  demoSelfieChecks = [];
}

function sortAttendance(entries: AttendanceEntry[]): AttendanceEntry[] {
  return [...entries].sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
}

function sortLocationSegments(segments: AttendanceLocationSegment[]): AttendanceLocationSegment[] {
  return [...segments].sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());
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

export async function listTodayLocationSegmentsForUser(
  userId: string,
  date = getTodayKey(),
): Promise<AttendanceLocationSegment[]> {
  if (!isSupabaseConfigured) {
    return sortLocationSegments(
      demoLocationSegments.filter((segment) => segment.userId === userId && segment.workDate === date),
    );
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_location_segments")
    .select("*")
    .eq("user_id", userId)
    .eq("work_date", date)
    .order("check_in_at");

  if (error) {
    throw error;
  }

  return data.map(mapLocationSegmentRow);
}

export async function getActiveLocationSegment(
  userId: string,
  date = getTodayKey(),
): Promise<AttendanceLocationSegment | null> {
  const segments = await listTodayLocationSegmentsForUser(userId, date);
  return segments.find((segment) => !segment.checkOutAt) ?? null;
}

export async function getCurrentAttendanceLocationId(userId: string, date = getTodayKey()): Promise<string | null> {
  const segment = await getActiveLocationSegment(userId, date);
  if (segment) {
    return segment.locationId;
  }

  const entry = await getActiveAttendance(userId, date);
  return entry?.locationId ?? null;
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

export async function listAttendanceForMonth(month: string): Promise<AttendanceEntry[]> {
  const start = `${month}-01`;
  const end = nextMonthStart(month);

  if (!isSupabaseConfigured) {
    return sortAttendance(demoAttendance.filter((entry) => entry.workDate >= start && entry.workDate < end));
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_entries")
    .select("*")
    .gte("work_date", start)
    .lt("work_date", end)
    .order("work_date")
    .order("check_in_at");

  if (error) {
    throw error;
  }

  return data.map(mapAttendanceRow);
}

export async function listSelfieChecksForAttendanceIds(attendanceEntryIds: string[]): Promise<AttendanceSelfieCheck[]> {
  if (attendanceEntryIds.length === 0) {
    return [];
  }

  if (!isSupabaseConfigured) {
    return demoSelfieChecks.filter((check) => attendanceEntryIds.includes(check.attendanceEntryId));
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_selfie_checks")
    .select("*")
    .in("attendance_entry_id", attendanceEntryIds)
    .order("created_at");

  if (error) {
    throw error;
  }

  return data.map(mapSelfieCheckRow);
}

function nextMonthStart(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) {
    throw new Error("Month must be in YYYY-MM format.");
  }
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
}

export async function listRecentAttendanceSelfieReviews(days = 3): Promise<AttendanceSelfieReview[]> {
  if (!isSupabaseConfigured) {
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    return sortAttendance(demoAttendance)
      .filter((entry) => entry.selfieInUrl && new Date(entry.checkInAt).getTime() >= cutoffMs)
      .map((entry) => ({
        entry,
        check: demoSelfieChecks.find((check) => check.attendanceEntryId === entry.id) ?? null,
        selfieUrl: entry.selfieInUrl,
      }));
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("attendance_entries")
    .select("*")
    .gte("check_in_at", cutoff)
    .not("selfie_in_url", "is", null)
    .order("check_in_at", { ascending: false });

  if (error) {
    throw error;
  }

  const entries = data.map(mapAttendanceRow);
  const checks = await listSelfieChecksForAttendanceIds(entries.map((entry) => entry.id));
  const checkByEntryId = new Map(checks.map((check) => [check.attendanceEntryId, check]));

  return Promise.all(
    entries.map(async (entry) => {
      const check = checkByEntryId.get(entry.id) ?? null;
      const selfiePath = check?.selfiePath ?? entry.selfieInUrl;
      const selfieUrl = selfiePath && !check?.storageDeletedAt
        ? await createSelfieSignedUrl(selfiePath)
        : null;
      return { entry, check, selfieUrl };
    }),
  );
}

async function createSelfieSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await requireSupabaseClient()
    .storage
    .from("attendance-selfies")
    .createSignedUrl(path, 10 * 60);

  if (error) {
    console.warn("Unable to create selfie preview URL.", error);
    return null;
  }

  return data.signedUrl;
}

async function uploadCheckInSelfie(profile: StaffProfile, workDate: string, now: Date, selfieFile: File): Promise<string> {
  const extension = fileExtensionFor(selfieFile);
  const path = `${profile.id}/${workDate}/check-in-${now.getTime()}-${Math.random().toString(16).slice(2)}.${extension}`;

  if (!isSupabaseConfigured) {
    return path;
  }

  const { error } = await requireSupabaseClient()
    .storage
    .from("attendance-selfies")
    .upload(path, selfieFile, {
      contentType: selfieFile.type || "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return path;
}

function fileExtensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.name.includes(".")) return file.name.split(".").at(-1)?.toLowerCase() || "jpg";
  return "jpg";
}

async function createSelfieCheck(attendanceEntryId: string, selfiePath: string): Promise<AttendanceSelfieCheck> {
  if (!isSupabaseConfigured) {
    const check: AttendanceSelfieCheck = {
      id: `selfie-check-${Date.now()}-${demoSelfieChecks.length}`,
      attendanceEntryId,
      selfieKind: "check_in",
      selfiePath,
      status: "queued",
      overallStatus: null,
      apronStatus: null,
      headwearStatus: null,
      gloveThumbsUpStatus: null,
      confidence: null,
      model: null,
      notes: null,
      errorMessage: null,
      checkedAt: null,
      archiveProvider: null,
      archivePath: null,
      archiveFileId: null,
      archivedAt: null,
      storageDeletedAt: null,
      archiveError: null,
      createdAt: new Date().toISOString(),
    };
    demoSelfieChecks.push(check);
    return check;
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_selfie_checks")
    .insert({
      attendance_entry_id: attendanceEntryId,
      selfie_kind: "check_in",
      selfie_path: selfiePath,
      status: "queued",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapSelfieCheckRow(data);
}

async function requestSelfieProcessing(attendanceEntryId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  try {
    const { data } = await requireSupabaseClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      return;
    }

    const response = await fetch("/api/attendance-selfie-checks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ attendanceEntryId }),
    });

    if (!response.ok) {
      console.warn("Queued selfie for later processing.", await response.text());
    }
  } catch (error) {
    console.warn("Queued selfie for later processing.", error);
  }
}

async function startLocationSegment(entry: AttendanceEntry, locationId: string, now: Date): Promise<void> {
  const checkInAt = now.toISOString();

  if (!isSupabaseConfigured) {
    demoLocationSegments.push({
      id: `attendance-location-${Date.now()}-${demoLocationSegments.length}`,
      attendanceEntryId: entry.id,
      userId: entry.userId,
      locationId,
      workDate: entry.workDate,
      checkInAt,
      checkOutAt: null,
    });
    return;
  }

  const { error } = await requireSupabaseClient()
    .from("attendance_location_segments")
    .insert({
      attendance_entry_id: entry.id,
      user_id: entry.userId,
      location_id: locationId,
      work_date: entry.workDate,
      check_in_at: checkInAt,
    });

  if (error) {
    throw error;
  }
}

async function closeActiveLocationSegment(userId: string, workDate: string, now: Date): Promise<void> {
  const checkOutAt = now.toISOString();

  if (!isSupabaseConfigured) {
    const activeSegment = demoLocationSegments.find(
      (segment) => segment.userId === userId && segment.workDate === workDate && !segment.checkOutAt,
    );
    if (activeSegment) {
      activeSegment.checkOutAt = checkOutAt;
    }
    return;
  }

  const { error } = await requireSupabaseClient()
    .from("attendance_location_segments")
    .update({ check_out_at: checkOutAt })
    .eq("user_id", userId)
    .eq("work_date", workDate)
    .is("check_out_at", null);

  if (error) {
    throw error;
  }
}

async function ensurePriorLocationSegment(entry: AttendanceEntry, now: Date): Promise<void> {
  if (!entry.locationId) {
    return;
  }

  const activeSegment = await getActiveLocationSegment(entry.userId, entry.workDate);
  if (activeSegment) {
    return;
  }

  const checkOutAt = now.toISOString();

  if (!isSupabaseConfigured) {
    demoLocationSegments.push({
      id: `attendance-location-${Date.now()}-${demoLocationSegments.length}`,
      attendanceEntryId: entry.id,
      userId: entry.userId,
      locationId: entry.locationId,
      workDate: entry.workDate,
      checkInAt: entry.checkInAt,
      checkOutAt,
    });
    return;
  }

  const { error } = await requireSupabaseClient()
    .from("attendance_location_segments")
    .insert({
      attendance_entry_id: entry.id,
      user_id: entry.userId,
      location_id: entry.locationId,
      work_date: entry.workDate,
      check_in_at: entry.checkInAt,
      check_out_at: checkOutAt,
    });

  if (error) {
    throw error;
  }
}

export async function checkIn(
  profile: StaffProfile,
  locationId: string | null,
  now = new Date(),
  locationEvidence?: AttendanceLocationEvidence | null,
  selfieFile?: File | null,
): Promise<AttendanceEntry> {
  if (!locationId) {
    throw new Error("Work location is required.");
  }

  if (!selfieFile) {
    throw new Error("Check-in selfie is required.");
  }

  const workDate = getTodayKey(now);
  const existing = await getActiveAttendance(profile.id, workDate);

  if (existing) {
    throw new Error("Attendance is already active. Check out before starting another shift.");
  }

  const selfiePath = await uploadCheckInSelfie(profile, workDate, now, selfieFile);

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
      selfieInUrl: selfiePath,
      selfieOutUrl: null,
    };
    demoAttendance.push(created);
    await startLocationSegment(created, locationId, now);
    await createSelfieCheck(created.id, selfiePath);
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
      selfie_in_url: selfiePath,
      ...buildLocationColumns("check_in", locationEvidence),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  const entry = mapAttendanceRow(data);
  await startLocationSegment(entry, locationId, now);
  await createSelfieCheck(entry.id, selfiePath);
  void requestSelfieProcessing(entry.id);
  return entry;
}

export async function switchAttendanceLocation(
  entry: AttendanceEntry,
  locationId: string | null,
  now = new Date(),
): Promise<AttendanceEntry> {
  if (entry.checkOutAt) {
    throw new Error("Attendance is already checked out for today.");
  }

  if (!locationId) {
    throw new Error("Work location is required.");
  }

  const activeSegment = await getActiveLocationSegment(entry.userId, entry.workDate);
  const currentLocationId = activeSegment?.locationId ?? entry.locationId;

  if (currentLocationId === locationId) {
    return entry;
  }

  await ensurePriorLocationSegment(entry, now);
  await closeActiveLocationSegment(entry.userId, entry.workDate, now);

  if (!isSupabaseConfigured) {
    const existing = demoAttendance.find((item) => item.id === entry.id);
    if (!existing) {
      throw new Error("Attendance entry not found.");
    }

    existing.locationId = locationId;
    await startLocationSegment(existing, locationId, now);
    return { ...existing };
  }

  const { data, error } = await requireSupabaseClient()
    .from("attendance_entries")
    .update({ location_id: locationId })
    .eq("id", entry.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  const updatedEntry = mapAttendanceRow(data);
  await startLocationSegment(updatedEntry, locationId, now);
  return updatedEntry;
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
    await closeActiveLocationSegment(existing.userId, existing.workDate, now);
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

  const updatedEntry = mapAttendanceRow(data);
  await closeActiveLocationSegment(updatedEntry.userId, updatedEntry.workDate, now);
  return updatedEntry;
}
