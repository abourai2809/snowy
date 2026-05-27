import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

type QueryResult = { rows: Array<Record<string, unknown>> };
type PoolLike = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  end: () => Promise<void>;
};

let pool: PoolLike | undefined;

const expectedTables = [
  "roles",
  "locations",
  "users",
  "holiday_policies",
  "flavours",
  "catalog_categories",
  "catalog_items",
  "raw_materials",
  "supplies",
  "products",
  "product_components",
  "inventory_balances",
  "gelato_batches",
  "pans",
  "pan_events",
  "dispatches",
  "dispatch_items",
  "store_receipts",
  "display_movements",
  "end_of_day_counts",
  "end_of_day_count_items",
  "inventory_adjustments",
  "attendance_entries",
  "attendance_selfie_checks",
  "attendance_adjustments",
  "urgent_requirements",
  "urgent_requirement_events",
  "queuebuster_jobs",
  "queuebuster_job_events",
  "archive_manifests",
  "archive_files",
  "app_settings",
];

const expectedEnums = [
  "app_role",
  "location_type",
  "catalog_scope",
  "catalog_item_kind",
  "salary_type",
  "pan_role",
  "pan_status",
  "dispatch_status",
  "receipt_status",
  "fill_state",
  "count_status",
  "attendance_status",
  "queuebuster_job_type",
  "queuebuster_job_status",
  "archive_manifest_status",
  "archive_manifest_mode",
];

const expectedViews = [
  "store_empty_pan_counts",
];

describe("operations database schema", { skip: !connectionString }, () => {
  before(async () => {
    const pg = await import("pg") as unknown as { Pool: new (config: { connectionString: string }) => PoolLike };
    pool = new pg.Pool({ connectionString: connectionString as string });
  });

  after(async () => {
    await pool?.end();
  });

  it("creates required public tables", async () => {
    const result = await pool!.query(
      `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
      order by table_name
      `
    );

    const actual = new Set(result.rows.map((row) => String(row.table_name)));
    for (const tableName of expectedTables) {
      assert.equal(actual.has(tableName), true, `missing table ${tableName}`);
    }
  });

  it("creates required enum types", async () => {
    const result = await pool!.query(
      `
      select t.typname
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typtype = 'e'
      order by t.typname
      `
    );

    const actual = new Set(result.rows.map((row) => String(row.typname)));
    for (const enumName of expectedEnums) {
      assert.equal(actual.has(enumName), true, `missing enum ${enumName}`);
    }
  });

  it("creates required public views", async () => {
    const result = await pool!.query(
      `
      select table_name
      from information_schema.views
      where table_schema = 'public'
      order by table_name
      `
    );

    const actual = new Set(result.rows.map((row) => String(row.table_name)));
    for (const viewName of expectedViews) {
      assert.equal(actual.has(viewName), true, `missing view ${viewName}`);
    }
  });

  it("enables row level security on application tables", async () => {
    const result = await pool!.query(
      `
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname = any($1)
        and c.relrowsecurity = true
      `,
      [expectedTables]
    );

    const secured = new Set(result.rows.map((row) => String(row.relname)));
    for (const tableName of expectedTables) {
      assert.equal(secured.has(tableName), true, `RLS is not enabled for ${tableName}`);
    }
  });

  it("loads seed master data", async () => {
    const result = await pool!.query(
      `
      select
        (select count(*)::int from public.roles) as roles_count,
        (select count(*)::int from public.locations) as locations_count,
        (select count(*)::int from public.flavours) as flavours_count,
        (select count(*)::int from public.catalog_categories) as categories_count,
        (select count(*)::int from public.catalog_items) as items_count
      `
    );

    const row = result.rows[0];
    assert.equal(row.roles_count, 5);
    assert.equal(row.locations_count, 4);
    assert.equal(row.flavours_count, 30);
    assert.equal(row.categories_count, 5);
    assert.equal(row.items_count, 17);
  });

  it("blocks non-admin catalog writes through RLS", async () => {
    await pool!.query("begin");
    try {
      await pool!.query(
        `
        insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        values ('00000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'schema-staff@example.com', '', now(), now(), now())
        `
      );
      await pool!.query(
        `
        insert into public.users (auth_user_id, name, phone, role, default_location_id)
        values ('00000000-0000-0000-0000-000000000202', 'Schema Staff', '9000000202', 'store_staff', 'rajpur')
        `
      );
      await pool!.query("set local role authenticated");
      await pool!.query("set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000202'");

      await assert.rejects(
        pool!.query(
          `
          insert into public.catalog_categories (category_key, name, item_kind, scope)
          values ('schema-staff-denied', 'Schema Staff Denied', 'supply', 'store')
          `
        )
      );
    } finally {
      await pool!.query("rollback");
    }
  });

  it("allows admin catalog writes through RLS", async () => {
    await pool!.query("begin");
    try {
      await pool!.query(
        `
        insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        values ('00000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'schema-admin@example.com', '', now(), now(), now())
        `
      );
      await pool!.query(
        `
        insert into public.users (auth_user_id, name, phone, role)
        values ('00000000-0000-0000-0000-000000000201', 'Schema Admin', '9000000201', 'admin')
        `
      );
      await pool!.query("set local role authenticated");
      await pool!.query("set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000201'");

      await pool!.query(
        `
        insert into public.catalog_categories (category_key, name, item_kind, scope)
        values ('schema-admin-allowed', 'Schema Admin Allowed', 'supply', 'store')
        `
      );
    } finally {
      await pool!.query("rollback");
    }
  });
});
