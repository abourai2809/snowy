import { createHash } from "node:crypto";

export const DEFERRED_ARCHIVE_SOURCES = [
  {
    source: "queuebuster_raw_csv_downloads",
    sourceKind: "raw_pos_csv",
    retentionClass: "Google Drive archive only",
    reason: "QueueBuster CSV download/import tables are not implemented yet.",
  },
  {
    source: "parsed_pos_staging_rows",
    sourceKind: "parsed_pos_staging",
    retentionClass: "Supabase recent-window + Drive archive",
    reason: "Parsed POS staging rows will be added with POS reconciliation.",
  },
];

export function parseArchiveWindow(env = process.env, now = new Date()) {
  if (env.ARCHIVE_WINDOW_START || env.ARCHIVE_WINDOW_END) {
    if (!env.ARCHIVE_WINDOW_START || !env.ARCHIVE_WINDOW_END) {
      throw new Error("Set both ARCHIVE_WINDOW_START and ARCHIVE_WINDOW_END, or neither.");
    }

    return normalizeWindow(env.ARCHIVE_WINDOW_START, env.ARCHIVE_WINDOW_END);
  }

  if (env.ARCHIVE_MONTH) {
    if (!/^\d{4}-\d{2}$/.test(env.ARCHIVE_MONTH)) {
      throw new Error("ARCHIVE_MONTH must use YYYY-MM format.");
    }
    const [year, month] = env.ARCHIVE_MONTH.split("-").map(Number);
    return monthWindow(year, month);
  }

  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return monthWindow(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth() + 1);
}

export function buildRunId(environment, window, now = new Date()) {
  const timestamp = now.toISOString().replace(/[-:.]/g, "").slice(0, 15);
  return `${environment}_${window.archiveMonth}_${timestamp}Z`;
}

export function buildDryRunManifest({
  environment,
  window,
  runId,
  codeVersion = "local",
  createdAt = new Date().toISOString(),
  candidates = [],
  deferredSources = DEFERRED_ARCHIVE_SOURCES,
}) {
  const sourceCount = candidates.length;
  const rowCount = candidates.reduce((sum, candidate) => sum + Number(candidate.row_count ?? candidate.rowCount ?? 0), 0);
  const sources = candidates.map((candidate) => normalizeCandidate(candidate));
  const manifest = {
    schemaVersion: 1,
    mode: "dry_run",
    status: "dry_run",
    runId,
    environment,
    createdAt,
    codeVersion,
    archiveWindow: {
      startDate: window.windowStart,
      endDateExclusive: window.windowEnd,
      archiveMonth: window.archiveMonth,
    },
    totals: {
      sourceCount,
      rowCount,
    },
    googleDrive: {
      liveModeDeferred: true,
      rootFolder: "Snowy Operations Archive",
      folderPath: buildDriveFolderPath(environment, window.archiveMonth),
      credentialsPolicy: "Backend or VM secrets only. Do not commit credentials or expose them to frontend JavaScript.",
    },
    deletion: {
      allowed: false,
      status: "not_started",
      reason: "Dry-run manifests never upload to Drive and never delete Supabase rows.",
    },
    sources,
    deferredSources,
  };

  return {
    ...manifest,
    manifestSha256: sha256(stableJson(manifest)),
  };
}

export function buildDriveFolderPath(environment, archiveMonth) {
  const [year, month] = archiveMonth.split("-");
  return `Snowy Operations Archive/${environment}/${year}/${month}/manifests`;
}

export function stableJson(value) {
  return JSON.stringify(sortKeys(value), null, 2);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function monthWindow(year, oneBasedMonth) {
  if (!Number.isInteger(year) || !Number.isInteger(oneBasedMonth) || oneBasedMonth < 1 || oneBasedMonth > 12) {
    throw new Error("Archive month must be a valid calendar month.");
  }

  const start = new Date(Date.UTC(year, oneBasedMonth - 1, 1));
  const end = new Date(Date.UTC(year, oneBasedMonth, 1));
  return normalizeWindow(toDateString(start), toDateString(end));
}

function normalizeWindow(windowStart, windowEnd) {
  if (!isDateString(windowStart) || !isDateString(windowEnd)) {
    throw new Error("Archive window dates must use YYYY-MM-DD format.");
  }

  const start = new Date(`${windowStart}T00:00:00.000Z`);
  const end = new Date(`${windowEnd}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error("Archive window end must be after archive window start.");
  }

  return {
    windowStart,
    windowEnd,
    archiveMonth: windowStart.slice(0, 7),
  };
}

function normalizeCandidate(candidate) {
  return {
    sourceTable: candidate.source_table ?? candidate.sourceTable,
    sourceKind: candidate.source_kind ?? candidate.sourceKind,
    retentionClass: candidate.retention_class ?? candidate.retentionClass,
    windowStart: candidate.window_start ?? candidate.windowStart,
    windowEnd: candidate.window_end ?? candidate.windowEnd,
    dateColumn: candidate.date_column ?? candidate.dateColumn,
    predicate: candidate.predicate,
    rowCount: Number(candidate.row_count ?? candidate.rowCount ?? 0),
    primaryKeyHash: candidate.primary_key_hash ?? candidate.primaryKeyHash ?? null,
    schemaHash: candidate.schema_hash ?? candidate.schemaHash ?? null,
    minBusinessDate: candidate.min_business_date ?? candidate.minBusinessDate ?? null,
    maxBusinessDate: candidate.max_business_date ?? candidate.maxBusinessDate ?? null,
    notes: candidate.notes ?? null,
    destination: {
      provider: "google_drive",
      mode: "future_live_mode",
      fileId: null,
      checksumSha256: null,
      byteSize: null,
    },
    verification: {
      status: "not_uploaded",
      verifiedAt: null,
    },
    deletion: {
      status: "not_started",
      deletedAt: null,
      deletedRowCount: null,
    },
  };
}

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortKeys(value[key]);
      return sorted;
    }, {});
}
