---
name: migrations
description: Multi-tenant migration workflow. Migrations are files, never applied to a live database without an explicit request. Covers idempotent DDL, the tenant vs master directories, and the sync scripts. Always use when creating or modifying a migration.
---

# Migrations

## Rule zero

**Migrations are files.** Writing one is a code change. Applying one to a live
database is an operational action that the developer takes — never an agent, and
never as a side effect of "finishing the task".

That includes `npm run db:migrate`, `db:reset`, `sync-tenant-migrations`,
`sync-master-migrations`, and any SQL run through the Supabase MCP tools.

Write the file. Say it is ready. Stop.

## Two directories

| | `supabase/migrations/` | `master_migrations/` |
|---|---|---|
| Applies to | every tenant database | the registry only |
| Contents | `users`, `system_settings`, module tables | the `tenants` table |
| Tracking table | `_applied_migrations` | `_master_applied_migrations` |
| Sync | `npm run sync-tenant-migrations` | `npm run sync-master-migrations` |
| Local | `npm run db:migrate` | same stack when `USE_LOCAL_DB=true` |

Both tracking tables key on a column named `filename`. If a DDL ever declares it
differently, every migration re-runs on every sync — silently, because the
inserts fail and the reads come back empty.

## Naming

`YYYYMMDDHHMMSS_short_description.sql`

The timestamp prefix is mandatory: `getMigrationFilenames()` sorts
alphabetically and relies on that being chronological.

## Idempotency is not optional

Tenants are at different points in the sequence, provisioning replays the whole
directory onto a new project, and a failed sync is resumed by re-running it. A
migration that only works once will eventually run twice.

```sql
CREATE TABLE IF NOT EXISTS public.invoices (...);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE OR REPLACE FUNCTION public.invoice_total(...) ...;

DROP POLICY IF EXISTS "invoices_read" ON public.invoices;
CREATE POLICY "invoices_read" ON public.invoices ...;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date DATE;
```

For DDL with no `IF NOT EXISTS` form:

```sql
DO $$
BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_amount_positive CHECK (amount > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

## Never edit an applied migration

Once a file has run anywhere, it is history. `_applied_migrations` holds its
name, so an edit reaches new tenants and never reaches existing ones — the worst
possible outcome, because nothing fails.

Changing something means a **new** file.

## Every table needs RLS

A table without RLS is readable by anyone holding the tenant's anon key, which
is in every browser on that subdomain.

```sql
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_read" ON public.invoices;
CREATE POLICY "invoices_read" ON public.invoices
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "invoices_manage" ON public.invoices;
CREATE POLICY "invoices_manage" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
```

Go through `public.is_admin()` / `public.current_app_role()` rather than
inlining a role list — see the `roles-permissions` skill.

## Rollout, when the developer runs it

1. `npm run db:migrate` — local, verify the schema and the app
2. `npm run sync-tenant-migrations -- --tenant=<one> --dry-run`
3. `npm run sync-tenant-migrations -- --tenant=<one>` — verify that tenant
4. `npm run sync-tenant-migrations` — the rest

The sync script stops a tenant at its first failure but continues with the
others, so one bad tenant does not block a fleet.

## Keeping types in sync

`types/database.types.ts` is hand-written to match the baseline. After adding
tables, either extend it by hand or regenerate:

```bash
npx supabase gen types typescript --local > types/database.types.ts
```

Two things to preserve if you regenerate:
- `UserRole` imported from `types/roles.ts`, not inlined
- row shapes as `type` aliases — an `interface` fails Supabase's
  `Record<string, unknown>` constraint and makes every query resolve to `never`

## Checklist

- [ ] File written; NOT applied to any live database
- [ ] `YYYYMMDDHHMMSS_` prefix
- [ ] Correct directory (tenant vs master)
- [ ] Every statement idempotent
- [ ] No existing migration edited
- [ ] RLS enabled with policies on every new table
- [ ] `types/database.types.ts` updated
