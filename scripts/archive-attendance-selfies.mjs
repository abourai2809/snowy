import { createSign } from "node:crypto";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "attendance-selfies";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function readAttendanceSelfieArchiveConfig(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceAccountJson = env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || "";
  const driveFolderId = env.GOOGLE_DRIVE_ATTENDANCE_SELFIE_FOLDER_ID || "";
  const retentionDays = parsePositiveInteger(env.ATTENDANCE_SELFIE_REVIEW_DAYS)
    ?? parsePositiveInteger(env.ATTENDANCE_SELFIE_ARCHIVE_AFTER_DAYS)
    ?? 3;
  const maxFiles = parsePositiveInteger(env.ATTENDANCE_SELFIE_ARCHIVE_MAX) ?? 50;
  const dryRun = env.ATTENDANCE_SELFIE_ARCHIVE_DRY_RUN === "1";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, before archiving selfies.");
  }

  if (!dryRun && (!serviceAccountJson || !driveFolderId)) {
    throw new Error(
      "Set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_ATTENDANCE_SELFIE_FOLDER_ID, or use ATTENDANCE_SELFIE_ARCHIVE_DRY_RUN=1.",
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    serviceAccountJson,
    driveFolderId,
    retentionDays,
    maxFiles,
    dryRun,
  };
}

export async function archiveAttendanceSelfies(options) {
  const config = { dryRun: false, retentionDays: 3, maxFiles: 50, ...options };
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const checks = await listArchivableChecks(supabase, config);
  const token = config.dryRun ? null : await getDriveAccessToken(config.serviceAccountJson);
  const results = [];

  for (const check of checks) {
    results.push(await archiveOneCheck(supabase, token, config, check));
  }

  return { scanned: checks.length, archived: results.filter((result) => result.status === "archived").length, results };
}

async function listArchivableChecks(supabase, config) {
  const cutoff = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("attendance_selfie_checks")
    .select("id, attendance_entry_id, selfie_path, created_at, archive_file_id, archived_at, storage_deleted_at")
    .not("selfie_path", "is", null)
    .is("storage_deleted_at", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(config.maxFiles);

  if (error) throw error;
  return data ?? [];
}

async function archiveOneCheck(supabase, driveAccessToken, config, check) {
  try {
    const fileName = archiveFileName(check);
    const archivePath = `${config.driveFolderId}/${fileName}`;

    if (config.dryRun) {
      return { checkId: check.id, status: "dry_run", selfiePath: check.selfie_path, archivePath };
    }

    let driveFileId = check.archive_file_id;
    if (!check.archived_at || !driveFileId) {
      const selfie = await downloadSelfie(supabase, check.selfie_path);
      const driveFile = await uploadToDrive({
        accessToken: driveAccessToken,
        folderId: config.driveFolderId,
        fileName,
        mimeType: selfie.mimeType,
        bytes: selfie.bytes,
      });
      driveFileId = driveFile.id;

      const archivedAt = new Date().toISOString();
      await updateCheck(supabase, check.id, {
        archive_provider: "google_drive",
        archive_path: archivePath,
        archive_file_id: driveFileId,
        archived_at: archivedAt,
        archive_error: null,
        updated_at: archivedAt,
      });
    }

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([check.selfie_path]);
    if (removeError) {
      throw removeError;
    }

    const storageDeletedAt = new Date().toISOString();
    await updateCheck(supabase, check.id, {
      storage_deleted_at: storageDeletedAt,
      updated_at: storageDeletedAt,
    });

    return { checkId: check.id, status: "archived", driveFileId, archivePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateCheck(supabase, check.id, {
      archive_error: message.slice(0, 1_000),
      updated_at: new Date().toISOString(),
    });
    return { checkId: check.id, status: "failed", error: message };
  }
}

async function downloadSelfie(supabase, selfiePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(selfiePath);
  if (error) throw error;

  return {
    bytes: Buffer.from(await data.arrayBuffer()),
    mimeType: data.type || mimeTypeForPath(selfiePath),
  };
}

async function updateCheck(supabase, checkId, patch) {
  const { error } = await supabase
    .from("attendance_selfie_checks")
    .update(patch)
    .eq("id", checkId);

  if (error) throw error;
}

async function getDriveAccessToken(serviceAccountJson) {
  const serviceAccount = parseServiceAccount(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      alg: "RS256",
      typ: "JWT",
    },
    {
      iss: serviceAccount.client_email,
      scope: DRIVE_SCOPE,
      aud: DRIVE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    },
    serviceAccount.private_key,
  );
  const response = await fetch(DRIVE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Drive token request failed with ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("Google Drive token response did not include an access token.");
  }

  return payload.access_token;
}

function signJwt(header, claim, privateKey) {
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(claim)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${base64Url(signer.sign(normalizePrivateKey(privateKey)))}`;
}

async function uploadToDrive({ accessToken, folderId, fileName, mimeType, bytes }) {
  const boundary = `snowy-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const metadata = {
    name: fileName,
    parents: [folderId],
    description: "Snowy Owl attendance selfie archive",
  };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(`${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(`Google Drive upload failed with ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function parseServiceAccount(serviceAccountJson) {
  const serviceAccount = JSON.parse(serviceAccountJson);
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Google service account JSON must include client_email and private_key.");
  }
  return serviceAccount;
}

function archiveFileName(check) {
  const date = String(check.created_at ?? new Date().toISOString()).slice(0, 10);
  return `${date}-${check.id}-${basename(check.selfie_path)}`;
}

function mimeTypeForPath(path) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function normalizePrivateKey(privateKey) {
  return privateKey.replace(/\\n/g, "\n");
}

function base64UrlJson(value) {
  return base64Url(Buffer.from(JSON.stringify(value)));
}

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  archiveAttendanceSelfies(readAttendanceSelfieArchiveConfig())
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
