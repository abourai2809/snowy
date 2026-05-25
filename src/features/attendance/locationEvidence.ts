import {
  validateAttendanceLocation,
  type AttendanceGeoReading,
  type AttendanceLocationEvidence,
  type AttendanceLocationStatus,
} from "../../domain/attendance";
import type { LocationOption } from "../../domain/roles";

export class AttendanceLocationError extends Error {
  constructor(
    message: string,
    public readonly status: AttendanceLocationStatus,
    public readonly evidence: AttendanceLocationEvidence | null = null,
  ) {
    super(message);
    this.name = "AttendanceLocationError";
  }
}

export async function collectVerifiedAttendanceLocation(location: LocationOption): Promise<AttendanceLocationEvidence> {
  const reading = await requestBrowserLocation();
  const validation = validateAttendanceLocation(location, reading);

  if (!validation.ok) {
    throw new AttendanceLocationError(
      validation.message ?? "Location could not be verified.",
      validation.evidence.status,
      validation.evidence,
    );
  }

  return validation.evidence;
}

export function requestBrowserLocation(): Promise<AttendanceGeoReading> {
  if (!navigator.geolocation) {
    return Promise.reject(
      new AttendanceLocationError(
        "This browser cannot provide location. Try from a phone browser with location services enabled.",
        "unsupported",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        });
      },
      (error) => {
        reject(new AttendanceLocationError(getLocationErrorMessage(error), getLocationErrorStatus(error)));
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0,
      },
    );
  });
}

function getLocationErrorStatus(error: GeolocationPositionError): AttendanceLocationStatus {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.POSITION_UNAVAILABLE) return "unavailable";
  if (error.code === error.TIMEOUT) return "timeout";
  return "unknown_error";
}

function getLocationErrorMessage(error: GeolocationPositionError): string {
  const status = getLocationErrorStatus(error);

  if (status === "denied") {
    return "Location permission was denied. Allow location access for this site and try again.";
  }

  if (status === "unavailable") {
    return "This device could not get a location. Turn on location services and try near the store entrance.";
  }

  if (status === "timeout") {
    return "Location request timed out. Move near the store entrance and try again.";
  }

  return "Unable to verify location. Try again or ask Admin to correct attendance.";
}
