import { isSupabaseConfigured, requireSupabaseClient } from "../../lib/supabase";

export interface OperationsSettings {
  locationCheckInRequired: boolean;
}

const LOCATION_CHECK_IN_REQUIRED_KEY = "location_check_in_required";
const defaultSettings: OperationsSettings = {
  locationCheckInRequired: true,
};

let demoSettings: OperationsSettings = { ...defaultSettings };

function parseBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  if (value && typeof value === "object" && "enabled" in value) {
    return parseBooleanSetting((value as { enabled?: unknown }).enabled, fallback);
  }
  return fallback;
}

export function resetDemoOperationsSettings() {
  demoSettings = { ...defaultSettings };
}

export async function getOperationsSettings(): Promise<OperationsSettings> {
  if (!isSupabaseConfigured) {
    return { ...demoSettings };
  }

  const { data, error } = await requireSupabaseClient()
    .from("app_settings")
    .select("value")
    .eq("key", LOCATION_CHECK_IN_REQUIRED_KEY)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return { ...defaultSettings };
    }
    throw error;
  }

  return {
    locationCheckInRequired: parseBooleanSetting(data?.value, defaultSettings.locationCheckInRequired),
  };
}

export async function updateLocationCheckInRequired(required: boolean): Promise<OperationsSettings> {
  if (!isSupabaseConfigured) {
    demoSettings = { ...demoSettings, locationCheckInRequired: required };
    return { ...demoSettings };
  }

  const { error } = await requireSupabaseClient()
    .from("app_settings")
    .upsert(
      {
        key: LOCATION_CHECK_IN_REQUIRED_KEY,
        value: required,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

  if (error) {
    throw error;
  }

  return { locationCheckInRequired: required };
}
