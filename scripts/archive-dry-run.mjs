#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildDryRunManifest,
  buildRunId,
  parseArchiveWindow,
  stableJson,
} from "./archive-dry-run-lib.mjs";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const environment = process.env.ARCHIVE_ENVIRONMENT || process.env.VERCEL_ENV || "development";
const outputDir = process.env.ARCHIVE_MANIFEST_DIR || "archive-manifests";
const codeVersion = process.env.ARCHIVE_CODE_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || "local";
const recordManifest = process.env.ARCHIVE_RECORD_MANIFEST === "1";
const logOnly = process.env.ARCHIVE_LOG_ONLY === "1";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL or VITE_SUPABASE_URL, plus SUPABASE_SERVICE_ROLE_KEY, before running archive dry-run.");
}

const window = parseArchiveWindow(process.env);
const createdAt = new Date().toISOString();
const runId = process.env.ARCHIVE_RUN_ID || buildRunId(environment, window, new Date(createdAt));

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
  const candidates = await loadCandidates();
  const manifest = buildDryRunManifest({
    environment,
    window,
    runId,
    codeVersion,
    createdAt,
    candidates,
  });
  const json = stableJson(manifest);

  let manifestPath = null;
  if (logOnly) {
    console.log(json);
  } else {
    manifestPath = await writeManifest(json);
    console.log(`Archive dry-run manifest written to ${manifestPath}`);
  }

  if (recordManifest) {
    await recordDryRunManifest(manifest, manifestPath);
    console.log(`Archive dry-run manifest recorded in Supabase as ${runId}`);
  }

  console.log(`Dry-run complete: ${manifest.totals.sourceCount} sources, ${manifest.totals.rowCount} rows. No uploads or deletes were performed.`);
}

async function loadCandidates() {
  const { data, error } = await supabase.rpc("build_archive_manifest_candidates", {
    p_window_start: window.windowStart,
    p_window_end: window.windowEnd,
  });

  if (error) {
    throw new Error(`Failed to build archive candidates: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

async function writeManifest(json) {
  await mkdir(outputDir, { recursive: true });
  const fileName = `manifest_${environment}_${window.archiveMonth}_${runId}.json`;
  const filePath = path.resolve(outputDir, fileName);
  await writeFile(filePath, `${json}\n`, "utf8");
  return filePath;
}

async function recordDryRunManifest(manifest, manifestPath) {
  const { data, error } = await supabase
    .from("archive_manifests")
    .insert({
      run_id: manifest.runId,
      environment: manifest.environment,
      mode: "dry_run",
      status: "dry_run",
      window_start: manifest.archiveWindow.startDate,
      window_end: manifest.archiveWindow.endDateExclusive,
      candidate_source_count: manifest.totals.sourceCount,
      candidate_row_count: manifest.totals.rowCount,
      manifest_payload: manifest,
      manifest_local_path: manifestPath,
      checksum_sha256: manifest.manifestSha256,
      code_version: manifest.codeVersion,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to record archive manifest: ${error.message}`);
  }

  const archiveFiles = manifest.sources.map((source) => ({
    manifest_id: data.id,
    source_table: source.sourceTable,
    source_kind: source.sourceKind,
    retention_class: source.retentionClass,
    window_start: source.windowStart,
    window_end: source.windowEnd,
    date_column: source.dateColumn,
    predicate: source.predicate,
    row_count: source.rowCount,
    primary_key_hash: source.primaryKeyHash,
    schema_hash: source.schemaHash,
    destination_provider: "google_drive",
    verification_status: "not_uploaded",
    deletion_status: "not_started",
    metadata: {
      notes: source.notes,
      minBusinessDate: source.minBusinessDate,
      maxBusinessDate: source.maxBusinessDate,
    },
  }));

  if (archiveFiles.length === 0) return;

  const { error: filesError } = await supabase
    .from("archive_files")
    .insert(archiveFiles);

  if (filesError) {
    throw new Error(`Failed to record archive file candidates: ${filesError.message}`);
  }
}
