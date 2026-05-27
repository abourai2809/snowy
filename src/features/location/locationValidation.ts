import { validateAttendanceLocation, type AttendanceGeoReading } from "../../domain/attendance";
import type { LocationOption } from "../../domain/roles";
import { requestBrowserLocation } from "../attendance/locationEvidence";

export type LocationValidationStatus = "verified" | "warning" | "unavailable";

export interface LocationValidationResult {
  status: LocationValidationStatus;
  message: string;
}

export async function validateLocationForStore(location: LocationOption): Promise<LocationValidationResult> {
  try {
    const reading = await requestBrowserLocation();
    return validateReadingForStore(location, reading);
  } catch {
    return {
      status: "unavailable",
      message: `Browser location could not verify ${location.name}. Continue only if you are counting this store.`,
    };
  }
}

export function validateReadingForStore(
  location: LocationOption,
  reading: AttendanceGeoReading,
): LocationValidationResult {
  const validation = validateAttendanceLocation(location, reading);

  if (validation.ok) {
    return {
      status: "verified",
      message: `Location verified for ${location.name}.`,
    };
  }

  return {
    status: "warning",
    message: `Browser location could not verify ${location.name}. Continue only if you are counting this store.`,
  };
}
