import { createClient } from "@supabase/supabase-js";

export function readAttendanceSelfieConfig(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiApiKey = env.GEMINI_API_KEY;
  const model = env.ATTENDANCE_SELFIE_MODEL || "gemini-2.5-flash-lite";
  const dryRun = env.ATTENDANCE_SELFIE_DRY_RUN === "1";
  const maxChecks = parsePositiveInteger(env.ATTENDANCE_SELFIE_MAX_CHECKS);
  const alertWebhookUrl = env.ATTENDANCE_SELFIE_ALERT_WEBHOOK_URL || "";
  const alertWebhookKind = env.ATTENDANCE_SELFIE_ALERT_WEBHOOK_KIND || "slack";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, before running the worker.");
  }

  if (!geminiApiKey && !dryRun) {
    throw new Error("Set GEMINI_API_KEY before running the attendance selfie worker, or set ATTENDANCE_SELFIE_DRY_RUN=1.");
  }

  return { supabaseUrl, serviceRoleKey, geminiApiKey, model, dryRun, maxChecks, alertWebhookUrl, alertWebhookKind };
}

export async function processQueuedAttendanceSelfies(options) {
  const config = {
    dryRun: false,
    maxChecks: 1,
    model: "gemini-2.5-flash-lite",
    alertWebhookUrl: "",
    alertWebhookKind: "slack",
    ...options,
  };
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const results = [];
  const limit = config.maxChecks || 1;

  while (results.length < limit) {
    const result = await processNextCheck(supabase, config);
    if (!result) break;
    results.push(result);
  }

  return {
    processed: results.length,
    results,
  };
}

async function processNextCheck(supabase, config) {
  const check = await claimNextCheck(supabase, config);
  if (!check) {
    return null;
  }

  try {
    const result = config.dryRun
      ? buildDryRunResult()
      : await validateSelfieWithGemini(supabase, config, check.selfie_path);
    await completeCheck(supabase, check.id, config.model, result);
    const processed = {
      checkId: check.id,
      attendanceEntryId: check.attendance_entry_id,
      status: "succeeded",
      overallStatus: result.overallStatus,
      apronStatus: result.apronStatus,
      headwearStatus: result.headwearStatus,
      gloveThumbsUpStatus: result.gloveThumbsUpStatus,
      confidence: result.confidence,
      notes: result.notes,
    };
    await maybeSendSelfieAlert(supabase, config, check, processed);
    return processed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failCheck(supabase, check.id, message);
    const processed = {
      checkId: check.id,
      attendanceEntryId: check.attendance_entry_id,
      status: "failed",
      overallStatus: "needs_review",
      errorMessage: message,
    };
    await maybeSendSelfieAlert(supabase, config, check, processed);
    return processed;
  }
}

async function claimNextCheck(supabase, config) {
  let query = supabase
    .from("attendance_selfie_checks")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (config.attendanceEntryId) {
    query = query.eq("attendance_entry_id", config.attendanceEntryId);
  }

  const { data: check, error } = await query.maybeSingle();

  if (error) throw error;
  if (!check) return null;

  const { data: claimed, error: claimError } = await supabase
    .from("attendance_selfie_checks")
    .update({
      status: "running",
      model: config.model,
      updated_at: new Date().toISOString(),
    })
    .eq("id", check.id)
    .eq("status", "queued")
    .select()
    .maybeSingle();

  if (claimError) throw claimError;
  return claimed;
}

async function validateSelfieWithGemini(supabase, config, selfiePath) {
  const image = await downloadSelfie(supabase, selfiePath);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: image.mimeType,
                  data: image.base64,
                },
              },
              {
                text: buildPrompt(),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return normalizeGeminiResult(JSON.parse(text || "{}"), payload);
}

async function downloadSelfie(supabase, selfiePath) {
  const { data, error } = await supabase.storage.from("attendance-selfies").download(selfiePath);
  if (error) throw error;

  const bytes = Buffer.from(await data.arrayBuffer());
  return {
    base64: bytes.toString("base64"),
    mimeType: data.type || mimeTypeForPath(selfiePath),
  };
}

function buildPrompt() {
  return [
    "You are checking a gelato store staff attendance selfie.",
    "Evaluate only visible evidence in the image. If a point is not clearly visible, mark it unclear.",
    "Return strict JSON with these keys only:",
    "{",
    '  "apron": "pass|fail|unclear",',
    '  "headwear": "pass|fail|unclear",',
    '  "glove_thumbs_up": "pass|fail|unclear",',
    '  "overall": "pass|needs_review",',
    '  "confidence": 0.0,',
    '  "notes": "short explanation"',
    "}",
    "Pass apron only if a work apron is visible.",
    "Pass headwear only if appropriate uniform headwear/hair covering is visible.",
    "Pass glove_thumbs_up only if a visible hand is wearing a glove and making a thumbs-up gesture.",
    "overall is pass only when all three checks pass.",
  ].join("\n");
}

function normalizeGeminiResult(result, rawResponse = {}) {
  const apron = normalizeSignal(result.apron);
  const headwear = normalizeSignal(result.headwear);
  const gloveThumbsUp = normalizeSignal(result.glove_thumbs_up);
  const overall =
    result.overall === "pass" && apron === "pass" && headwear === "pass" && gloveThumbsUp === "pass"
      ? "pass"
      : "needs_review";

  return {
    overallStatus: overall,
    apronStatus: apron,
    headwearStatus: headwear,
    gloveThumbsUpStatus: gloveThumbsUp,
    confidence: normalizeConfidence(result.confidence),
    notes: typeof result.notes === "string" ? result.notes.slice(0, 500) : null,
    rawResponse,
  };
}

function normalizeSignal(value) {
  return value === "pass" || value === "fail" || value === "unclear" ? value : "unclear";
}

function normalizeConfidence(value) {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return null;
  return Math.min(1, Math.max(0, confidence));
}

function buildDryRunResult() {
  return {
    overallStatus: "needs_review",
    apronStatus: "unclear",
    headwearStatus: "unclear",
    gloveThumbsUpStatus: "unclear",
    confidence: 0,
    notes: "Dry run: Gemini was not called.",
    rawResponse: { dryRun: true },
  };
}

async function completeCheck(supabase, checkId, model, result) {
  const { error } = await supabase
    .from("attendance_selfie_checks")
    .update({
      status: "succeeded",
      overall_status: result.overallStatus,
      apron_status: result.apronStatus,
      headwear_status: result.headwearStatus,
      glove_thumbs_up_status: result.gloveThumbsUpStatus,
      confidence: result.confidence,
      model,
      notes: result.notes,
      raw_response: result.rawResponse,
      error_message: null,
      checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", checkId);

  if (error) throw error;
}

async function failCheck(supabase, checkId, message) {
  const { error } = await supabase
    .from("attendance_selfie_checks")
    .update({
      status: "failed",
      overall_status: "needs_review",
      error_message: message.slice(0, 1_000),
      checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", checkId);

  if (error) throw error;
}

async function maybeSendSelfieAlert(supabase, config, check, result) {
  if (!config.alertWebhookUrl || result.overallStatus === "pass") {
    return;
  }

  try {
    const context = await loadAlertContext(supabase, check.attendance_entry_id);
    const payload = buildAlertPayload(context, result);
    const response = await fetch(config.alertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config.alertWebhookKind === "generic" ? payload : { text: payload.text }),
    });

    if (!response.ok) {
      console.warn(`Attendance selfie alert failed with ${response.status}: ${await response.text()}`);
    }
  } catch (error) {
    console.warn("Attendance selfie alert failed.", error);
  }
}

async function loadAlertContext(supabase, attendanceEntryId) {
  const { data: entry } = await supabase
    .from("attendance_entries")
    .select("id, user_id, location_id, work_date, check_in_at")
    .eq("id", attendanceEntryId)
    .maybeSingle();

  const [staffResult, locationResult] = await Promise.all([
    entry?.user_id
      ? supabase.from("users").select("name, role").eq("id", entry.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    entry?.location_id
      ? supabase.from("locations").select("name").eq("id", entry.location_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    entry,
    staff: staffResult.data,
    location: locationResult.data,
  };
}

function buildAlertPayload(context, result) {
  const staffName = context.staff?.name ?? "Unknown staff";
  const locationName = context.location?.name ?? context.entry?.location_id ?? "Unknown location";
  const workDate = context.entry?.work_date ?? "Unknown date";
  const notes = result.errorMessage || result.notes || "No notes.";
  const confidence = result.confidence === null || result.confidence === undefined
    ? "n/a"
    : `${Math.round(result.confidence * 100)}%`;

  return {
    text: [
      "Snowy Owl attendance selfie needs review",
      `Staff: ${staffName}`,
      `Location: ${locationName}`,
      `Date: ${workDate}`,
      `Overall: ${result.overallStatus}`,
      `Apron: ${result.apronStatus ?? "unclear"}`,
      `Headwear: ${result.headwearStatus ?? "unclear"}`,
      `Glove/thumbs-up: ${result.gloveThumbsUpStatus ?? "unclear"}`,
      `Confidence: ${confidence}`,
      `Notes: ${notes}`,
    ].join("\n"),
    result,
    staffName,
    locationName,
    workDate,
  };
}

function mimeTypeForPath(path) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}
