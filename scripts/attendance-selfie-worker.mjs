import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const model = process.env.ATTENDANCE_SELFIE_MODEL || "gemini-2.5-flash-lite";
const pollIntervalMs = Number(process.env.ATTENDANCE_SELFIE_POLL_INTERVAL_MS || 30_000);
const runOnce = process.env.ATTENDANCE_SELFIE_RUN_ONCE === "1";
const dryRun = process.env.ATTENDANCE_SELFIE_DRY_RUN === "1";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, before running the worker.");
}

if (!geminiApiKey && !dryRun) {
  throw new Error("Set GEMINI_API_KEY before running the attendance selfie worker, or set ATTENDANCE_SELFIE_DRY_RUN=1.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  console.log(`Attendance selfie worker started with ${model}${dryRun ? " (dry run)" : ""}.`);

  do {
    await processNextCheck();
    if (!runOnce) {
      await delay(pollIntervalMs);
    }
  } while (!runOnce);
}

async function processNextCheck() {
  const check = await claimNextCheck();
  if (!check) {
    if (runOnce) console.log("No queued attendance selfie checks.");
    return;
  }

  try {
    const result = dryRun
      ? buildDryRunResult()
      : await validateSelfieWithGemini(check.selfie_path);
    await completeCheck(check.id, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failCheck(check.id, message);
  }
}

async function claimNextCheck() {
  const { data: check, error } = await supabase
    .from("attendance_selfie_checks")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!check) return null;

  const { data: claimed, error: claimError } = await supabase
    .from("attendance_selfie_checks")
    .update({
      status: "running",
      model,
      updated_at: new Date().toISOString(),
    })
    .eq("id", check.id)
    .eq("status", "queued")
    .select()
    .maybeSingle();

  if (claimError) throw claimError;
  return claimed;
}

async function validateSelfieWithGemini(selfiePath) {
  const image = await downloadSelfie(selfiePath);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
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

async function downloadSelfie(selfiePath) {
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

async function completeCheck(checkId, result) {
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

async function failCheck(checkId, message) {
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

function mimeTypeForPath(path) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
