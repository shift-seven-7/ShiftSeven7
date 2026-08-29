# Migrations

## Migrations are files

Writing one is a code change. Applying one is an operational action the
developer takes deliberately — never an agent, and never as a side effect of
"finishing the task". That includes `db:migrate`, `db:reset`, both sync scripts,
and SQL run through Supabase tooling.

## Two directories

| | `supabase/migrations/` | `master_migrations/` |
|---|---|---|
| Target | every tenant database | the registry |
| Contents | `users`, `system_settings`, module tables | the `tenants` table |
| Tracking | `_applied_migrations` | `_master_applied_migrations` |
| Sync | `npm run sync-tenant-migrations` | `npm run sync-master-migrations` |
| Local | `npm run db:migrate` | the same stack when `USE_LOCAL_DB=true` |

Both tracking tables key on a column named `filename`. A DDL that declares it
otherwise makes every migration re-run on every sync — silently, because the
inserts fail and the reads return nothing.

## Naming

`YYYYMMDDHHMMSS_short_description.sql`

`getMigrationFilenames()` sorts alphabetically and depends on that being
chronological.

## Idempotency

Tenants sit at different points in the sequence, provisioning replays the whole
directory onto a new project, and a failed sync is resumed by re-running. A
migration that works only once will run twice.

```sql
CREATE TABLE IF NOT EXISTS public.invoices (...);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE OR REPLACE FUNCTION public.invoice_total(...) ...;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date DATE;

DROP POLICY IF EXISTS "invoices_read" ON public.invoices;
CREATE POLICY "invoices_read" ON public.invoices ...;
```

Where there is no `IF NOT EXISTS` form:

```sql
DO $$
BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_amount_positive CHECK (amount > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

## Never edit an applied migration

Once it has run anywhere it is history — `_applied_migrations` holds its name.
An edit reaches new tenants and never reaches existing ones, and nothing fails.
Changing something means a new file.

## RLS on every table

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
inlining a role list.

## Rollout

1. `npm run db:migrate` — local, verify schema and app
2. `npm run sync-tenant-migrations -- --tenant=<one> --dry-run`
3. `npm run sync-tenant-migrations -- --tenant=<one>` — verify that tenant
4. `npm run sync-tenant-migrations` — the rest

The script stops a tenant at its first failure and continues with the others, so
one bad tenant does not block a fleet. Exit code is non-zero if any failed.

## Types

`types/database.types.ts` is hand-written to match the baseline. After adding
tables, extend it or regenerate:

```bash
npx supabase gen types typescript --local > types/database.types.ts
```

Two things to preserve when regenerating:

- `UserRole` imported from `types/roles.ts`, not inlined — one definition of the
  role list
- row shapes as `type` aliases, not `interface`. Supabase constrains `Row` to
  `Record<string, unknown>`, and TypeScript grants an implicit index signature to
  a type alias but never to an interface. An interface makes every query resolve
  to `never`, with an error message that points nowhere near the cause.
