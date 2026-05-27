import { createClient } from "@supabase/supabase-js";
import { processQueuedAttendanceSelfies } from "../scripts/attendance-selfie-worker-lib.mjs";

function send(response, status, body) {
  response.status(status).json(body);
}

function bearerToken(request) {
  const header = request.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

function canProcessEntry(staff, entry) {
  if (!staff || !entry) return false;
  if (entry.user_id === staff.id) return true;
  return ["admin", "store_manager", "lab_manager"].includes(staff.role);
}

function requestBody(request) {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }

  return request.body ?? {};
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    send(response, 405, { error: "Method not allowed." });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const model = process.env.ATTENDANCE_SELFIE_MODEL ?? "gemini-2.5-flash-lite";
  const alertWebhookUrl = process.env.ATTENDANCE_SELFIE_ALERT_WEBHOOK_URL ?? "";
  const alertWebhookKind = process.env.ATTENDANCE_SELFIE_ALERT_WEBHOOK_KIND ?? "slack";
  const body = requestBody(request);
  const attendanceEntryId = String(body.attendanceEntryId ?? "");
  const token = bearerToken(request);

  if (!supabaseUrl || !serviceRoleKey || !geminiApiKey) {
    send(response, 503, { error: "Selfie check service is not configured." });
    return;
  }

  if (!attendanceEntryId || !token) {
    send(response, 400, { error: "Attendance entry and login token are required." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      send(response, 401, { error: "Login is required." });
      return;
    }

    const [{ data: staff, error: staffError }, { data: entry, error: entryError }] = await Promise.all([
      supabase
        .from("users")
        .select("id, role")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle(),
      supabase
        .from("attendance_entries")
        .select("id, user_id")
        .eq("id", attendanceEntryId)
        .maybeSingle(),
    ]);

    if (staffError) throw staffError;
    if (entryError) throw entryError;

    if (!canProcessEntry(staff, entry)) {
      send(response, 403, { error: "You cannot process this selfie check." });
      return;
    }

    const result = await processQueuedAttendanceSelfies({
      supabaseUrl,
      serviceRoleKey,
      geminiApiKey,
      model,
      maxChecks: 1,
      attendanceEntryId,
      alertWebhookUrl,
      alertWebhookKind,
    });

    send(response, 200, result);
  } catch (error) {
    send(response, 500, { error: error instanceof Error ? error.message : "Unable to process selfie check." });
  }
}
