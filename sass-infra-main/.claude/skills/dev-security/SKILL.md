---
name: dev-security
description: Security verification for new code. Check auth, RLS, OWASP. Always use after verifying implementation.
---

# Step 5: Security Check

Verify security of all new or modified code.

## What To Check

### API Route Authentication
- Every new API route must check Supabase auth (`supabase.auth.getUser()`)
- Exception: routes under `app/api/public/` are intentionally unauthenticated

### Role-Based Access Control
- Check the relevant feature doc's "User Roles & Access" table
- Ensure API routes enforce the correct role restrictions
- Use the role hierarchy from `docs/modules-and-roles.md`

### Row-Level Security (RLS)
- New database tables MUST have RLS enabled
- Create appropriate policies for select, insert, update, delete
- Run `get_advisors` (security) on the Supabase project to catch missing RLS policies

### Supabase Client Isolation
- Never import Supabase client (`@supabase/supabase-js`) in frontend components
- All Supabase operations must go through API routes

### OWASP Top 10
- Check for SQL injection (use parameterized queries)
- Check for XSS (sanitize user input rendered in HTML)
- Check for CSRF, insecure direct object references, etc.

## Database Migrations — Staging-First Rollout

**NEVER run database migrations without explicit developer approval.** Always present the migration SQL and wait for confirmation.

### Migration Rollout Order:
1. Run on **staging tenant first**: `npx tsx scripts/sync-tenant-migrations.ts --tenant=staging`
2. **Wait** for developer to verify the migration worked correctly on staging
3. **Only after approval**, run on all tenants: `npx tsx scripts/sync-tenant-migrations.ts`

## Checklist

- [ ] Auth check on all new API routes
- [ ] Role-based access enforced per feature doc
- [ ] RLS policies on new database tables
- [ ] No Supabase client in frontend components
- [ ] No OWASP vulnerabilities (SQL injection, XSS, etc.)
- [ ] `get_advisors` (security) run on Supabase project
- [ ] No migrations run without developer approval
- [ ] Migrations tested on staging tenant before production rollout
