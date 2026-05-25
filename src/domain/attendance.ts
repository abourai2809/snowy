export type AttendanceStatus = "active" | "checked_out" | "corrected" | "void";
export type AttendanceLocationStatus =
  | "verified"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "poor_accuracy"
  | "outside_radius"
  | "not_configured"
  | "unknown_error";

export interface AttendanceLocationEvidence {
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  validationLocationId: string | null;
  status: AttendanceLocationStatus;
  error: string | null;
}

export interface AttendanceEntry {
  id: string;
  userId: string;
  locationId: string | null;
  workDate: string;
  checkInAt: string;
  checkOutAt: string | null;
  hours: number | null;
  status: AttendanceStatus;
  checkInLocation: AttendanceLocationEvidence | null;
  checkOutLocation: AttendanceLocationEvidence | null;
}

export interface AttendanceLocationTarget {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  attendanceRadiusM: number;
  attendanceAccuracyLimitM: number;
}

export interface AttendanceGeoReading {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

export interface AttendanceLocationValidationResult {
  ok: boolean;
  evidence: AttendanceLocationEvidence;
  message: string | null;
}

export function getTodayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function calculateHours(checkInAt: string, checkOutAt: string): number {
  const ms = new Date(checkOutAt).getTime() - new Date(checkInAt).getTime();
  return Math.max(0, Math.round((ms / 3_600_000) * 10) / 10);
}

export function isCheckedOut(entry: AttendanceEntry | null): boolean {
  return Boolean(entry?.checkOutAt);
}

export function getDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earthRadiusM = 6_371_000;
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusM * c);
}

export function validateAttendanceLocation(
  target: AttendanceLocationTarget,
  reading: AttendanceGeoReading,
): AttendanceLocationValidationResult {
  if (target.latitude === null || target.longitude === null) {
    return {
      ok: false,
      evidence: {
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracyM: reading.accuracyM,
        distanceM: null,
        validationLocationId: target.id,
        status: "not_configured",
        error: `${target.name} is missing attendance coordinates.`,
      },
      message: `${target.name} is missing attendance coordinates. Ask Admin to update this location.`,
    };
  }

  const distanceM = getDistanceMeters(reading, {
    latitude: target.latitude,
    longitude: target.longitude,
  });

  if (reading.accuracyM > target.attendanceAccuracyLimitM) {
    return {
      ok: false,
      evidence: {
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracyM: reading.accuracyM,
        distanceM,
        validationLocationId: target.id,
        status: "poor_accuracy",
        error: `Location accuracy is ${Math.round(reading.accuracyM)}m.`,
      },
      message: `Location accuracy is too low (${Math.round(reading.accuracyM)}m). Move near the store entrance and try again.`,
    };
  }

  if (distanceM > target.attendanceRadiusM) {
    return {
      ok: false,
      evidence: {
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracyM: reading.accuracyM,
        distanceM,
        validationLocationId: target.id,
        status: "outside_radius",
        error: `Device is ${distanceM}m from ${target.name}.`,
      },
      message: `You are ${distanceM}m from ${target.name}. You need to be within ${target.attendanceRadiusM}m to mark attendance.`,
    };
  }

  return {
    ok: true,
    evidence: {
      latitude: reading.latitude,
      longitude: reading.longitude,
      accuracyM: reading.accuracyM,
      distanceM,
      validationLocationId: target.id,
      status: "verified",
      error: null,
    },
    message: null,
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
