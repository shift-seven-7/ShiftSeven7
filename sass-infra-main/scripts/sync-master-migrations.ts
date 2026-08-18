/**
 * Applies master_migrations/ to the MASTER registry database.
 *
 *   npm run db:migrate:master                       # local stack
 *   npm run sync-master-migrations                  # hosted master project
 *   npm run sync-master-migrations -- --dry-run
 *
 * Two targets, one set of migration files:
 *
 * | Target | Selected by | SQL runs through | Needs |
 * |---|---|---|---|
 * | local  | USE_LOCAL_DB=true, or --local | a direct Postgres connection | the stack running |
 * | hosted | otherwise | the Supabase Management API | MASTER_SUPABASE_URL, SUPABASE_MANAGEMENT_TOKEN |
 *
 * Neither target goes through PostgREST, including for the bookkeeping reads —
 * see readApplied().
 *
 * The local path exists because the registry table has to exist locally too —
 * `npm run dev` resolves tenants through the registry exactly as production
 * does, so without it no tenant resolves and every page 404s to
 * /tenant-not-found.
 *
 * Files are applied in filename order and recorded in
 * public._master_applied_migrations, so a re-run is a no-op. Write migrations
 * idempotently — see the `migrations` skill.
 */

import { loadEnvConfig } from '@next/env';
import { Client as PgClient } from 'pg';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const MIGRATIONS_DIR = path.join(projectDir, 'master_migrations');
const TRACKING_TABLE = '_master_applied_migrations';

// The tracking table must exist before anything can be recorded, and the
// baseline migration that creates it cannot record itself. Bootstrap it with
// the exact same DDL the baseline uses — `filename` as the primary key.
const TRACKING_DDL = `
  CREATE TABLE IF NOT EXISTS public.${TRACKING_TABLE} (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const isLocal = process.argv.includes('--local') || process.env.USE_LOCAL_DB === 'true';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local.`);
  return value;
}

function getProjectRef(): string {
  const url = requireEnv('MASTER_SUPABASE_URL');
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    throw new Error(
      `Cannot derive a project ref from MASTER_SUPABASE_URL (${url}). ` +
        'That variable must point at a hosted project. To target the local stack, ' +
        'set USE_LOCAL_DB=true or pass --local.'
    );
  }
  return match[1];
}

/**
 * Resolves the local Postgres connection string from the running stack.
 *
 * `supabase status -o env` is the supported way to read it, and it means the
 * script does not care which ports or container names the CLI chose.
 */
function getLocalDbUrl(): string {
  if (process.env.LOCAL_DATABASE_URL) return process.env.LOCAL_DATABASE_URL;

  let output: string;
  try {
    output = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf-8' });
  } catch {
    throw new Error(
      'Could not read the local Supabase status. Is the stack running? Try `npm run db:start`.'
    );
  }

  const match = output.match(/^DB_URL="?([^"\n]+)"?$/m);
  if (!match) {
    throw new Error('`supabase status -o env` did not report a DB_URL.');
  }
  return match[1];
}

/**
 * Runs SQL on the local Postgres and returns the rows.
 *
 * A direct connection, not `supabase db query`: that command wraps its input in
 * a prepared statement, which rejects multi-statement files ("cannot insert
 * multiple commands into a prepared statement"). node-pg uses the simple query
 * protocol for a parameterless query, so a whole migration — dollar-quoted
 * function bodies included — runs in one call.
 */
async function localQuery<T = unknown>(sql: string): Promise<T[]> {
  const client = new PgClient({ connectionString: getLocalDbUrl() });
  await client.connect();
  try {
    const result = await client.query(sql);
    return (Array.isArray(result) ? result[result.length - 1]?.rows : result.rows) ?? [];
  } finally {
    await client.end();
  }
}

/**
 * Runs SQL on the hosted master through the Management API and returns the rows.
 *
 * The endpoint answers with the result set as JSON — an empty array for DDL.
 */
async function hostedQuery<T = unknown>(sql: string): Promise<T[]> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${getProjectRef()}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requireEnv('SUPABASE_MANAGEMENT_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    throw new Error(`SQL execution failed (${response.status}): ${await response.text()}`);
  }

  const body = await response.json().catch(() => []);
  return Array.isArray(body) ? (body as T[]) : [];
}

/** Runs SQL against whichever master is selected. */
async function query<T = unknown>(sql: string): Promise<T[]> {
  return isLocal ? localQuery<T>(sql) : hostedQuery<T>(sql);
}

/**
 * Which migrations have already run.
 *
 * Both targets go through Postgres directly rather than PostgREST. The tracking
 * table was created moments ago by the DDL above, and PostgREST caches its
 * schema — a REST read here fails with "Could not find the table
 * 'public._master_applied_migrations' in the schema cache" on a table that
 * demonstrably exists. That is not a race worth waiting out: the cache refresh
 * is on PostgREST's own schedule, so the very first run against a fresh master
 * project would fail every time.
 */
async function readApplied(): Promise<Set<string>> {
  const rows = await query<{ filename: string }>(
    `SELECT filename FROM public.${TRACKING_TABLE};`
  );
  return new Set(rows.map((row) => row.filename));
}

async function recordApplied(filename: string): Promise<void> {
  await query(
    `INSERT INTO public.${TRACKING_TABLE} (filename) VALUES (${quoteLiteral(filename)})
     ON CONFLICT (filename) DO NOTHING;`
  );
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Tells PostgREST to re-read the schema.
 *
 * Without this, everything that talks to the database over REST — the seed
 * script, the app itself — keeps 404ing on the freshly created `tenants` table
 * until the container happens to refresh. True of the hosted project as much as
 * the local stack, so both get the notify.
 */
async function reloadPostgrestSchema(): Promise<void> {
  await query(`NOTIFY pgrst, 'reload schema';`);
}

function getMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`target: ${isLocal ? 'local Supabase stack' : 'hosted master project'}`);
  if (dryRun) console.log('=== DRY RUN — nothing will be applied ===\n');

  const migrations = getMigrationFiles();
  if (migrations.length === 0) {
    console.log('No .sql files in master_migrations/.');
    return;
  }

  if (!dryRun) await query(TRACKING_DDL);

  const applied = dryRun ? new Set<string>() : await readApplied();
  const pending = migrations.filter((file) => !applied.has(file));

  console.log(
    `${migrations.length} migration(s): ${applied.size} applied, ${pending.length} pending\n`
  );

  if (pending.length === 0) {
    console.log('Master registry is up to date.');
    return;
  }

  let failed = 0;

  for (const file of pending) {
    if (dryRun) {
      console.log(`  would apply  ${file}`);
      continue;
    }

    try {
      process.stdout.write(`  applying     ${file} ... `);
      await query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8'));
      await recordApplied(file);
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      console.error(`    ${describeError(err)}`);
      failed++;
      // Later migrations may depend on this one — stop rather than cascade.
      break;
    }
  }

  if (failed > 0) {
    console.error('\nStopped on the first failure. Fix the migration and re-run.');
    process.exit(1);
  }

  await reloadPostgrestSchema();
  console.log('\nMaster registry is up to date.');
}

/**
 * Renders whatever was thrown.
 *
 * Neither a child-process failure (useful text on `stderr`) nor a PostgREST
 * error (a plain object, so `String()` yields "[object Object]") is an Error,
 * and both are common here.
 */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;

  if (err && typeof err === 'object') {
    const candidate = err as { stderr?: Buffer | string; message?: string; hint?: string };
    if (candidate.stderr) return String(candidate.stderr).trim();
    if (candidate.message) {
      return candidate.hint ? `${candidate.message} (${candidate.hint})` : candidate.message;
    }
    return JSON.stringify(err);
  }

  return String(err);
}

main().catch((err) => {
  console.error('Fatal:', describeError(err));
  process.exit(1);
});
