import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads the tenant migration files off disk.
 *
 * Used by the provisioning wizard (to replay the whole schema onto a brand-new
 * tenant project) and by scripts/sync-tenant-migrations.ts.
 *
 * NOTE: these run at request time on the server. Next's output tracing cannot
 * follow `readdirSync`, so next.config.ts declares an explicit
 * `outputFileTracingIncludes` for the routes that call this — without it the
 * deployed build throws ENOENT.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

/**
 * All migration filenames in execution order.
 *
 * The YYYYMMDDHHMMSS_ prefix makes an alphabetical sort chronological — which
 * is exactly why the prefix is mandatory. Only top-level .sql files count;
 * anything archived in a subdirectory is ignored.
 */
export function getMigrationFilenames(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

export function readMigrationFile(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf-8');
}
