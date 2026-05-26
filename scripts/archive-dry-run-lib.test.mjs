import { describe, expect, it } from "vitest";
import {
  buildDriveFolderPath,
  buildDryRunManifest,
  parseArchiveWindow,
  stableJson,
} from "./archive-dry-run-lib.mjs";

describe("archive dry-run manifest helpers", () => {
  it("defaults to the previous closed calendar month", () => {
    const window = parseArchiveWindow({}, new Date("2026-05-25T12:00:00.000Z"));

    expect(window).toEqual({
      windowStart: "2026-04-01",
      windowEnd: "2026-05-01",
      archiveMonth: "2026-04",
    });
  });

  it("parses an explicit archive month", () => {
    const window = parseArchiveWindow({ ARCHIVE_MONTH: "2026-03" });

    expect(window.windowStart).toBe("2026-03-01");
    expect(window.windowEnd).toBe("2026-04-01");
  });

  it("builds a dry-run manifest that cannot delete or upload data", () => {
    const manifest = buildDryRunManifest({
      environment: "production",
      runId: "production_2026-03_test",
      codeVersion: "abc123",
      createdAt: "2026-05-25T10:00:00.000Z",
      window: {
        windowStart: "2026-03-01",
        windowEnd: "2026-04-01",
        archiveMonth: "2026-03",
      },
      candidates: [
        {
          source_table: "attendance_entries",
          source_kind: "database_table",
          retention_class: "Supabase recent-window + Drive archive",
          window_start: "2026-03-01",
          window_end: "2026-04-01",
          date_column: "work_date",
          predicate: "work_date >= '2026-03-01' and work_date < '2026-04-01'",
          row_count: 12,
          primary_key_hash: "pk-hash",
          schema_hash: "schema-hash",
        },
      ],
    });

    expect(manifest.mode).toBe("dry_run");
    expect(manifest.deletion.allowed).toBe(false);
    expect(manifest.googleDrive.liveModeDeferred).toBe(true);
    expect(manifest.totals.rowCount).toBe(12);
    expect(manifest.sources[0].destination.fileId).toBeNull();
    expect(manifest.manifestSha256).toHaveLength(64);
  });

  it("keeps manifest JSON stable for checksums", () => {
    const json = stableJson({ b: 2, a: { d: 4, c: 3 } });

    expect(json.indexOf("\"a\"")).toBeLessThan(json.indexOf("\"b\""));
    expect(json.indexOf("\"c\"")).toBeLessThan(json.indexOf("\"d\""));
  });

  it("builds the documented Google Drive manifest folder path", () => {
    expect(buildDriveFolderPath("production", "2026-03")).toBe(
      "Snowy Operations Archive/production/2026/03/manifests",
    );
  });
});
