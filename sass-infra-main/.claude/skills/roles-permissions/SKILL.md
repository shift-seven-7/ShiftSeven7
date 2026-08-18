---
name: roles-permissions
description: How to add a role and how authorization is enforced — the four edit points, the compiler-forced maps, and the RLS helper functions. Always use when adding a role, changing route permissions, or writing an RLS policy.
---

# Roles and permissions

Roles are fixed in code. The infrastructure ships with two: `ADMIN` and
`SYSTEM_MANAGER`. Adding more is a four-file change, and TypeScript refuses to
build until all four are done.

## The four edit points

Adding an `AREA_MANAGER`:

### 1. `types/roles.ts`

```ts
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  SYSTEM_MANAGER: 'SYSTEM_MANAGER',
  AREA_MANAGER: 'AREA_MANAGER',
} as const;
```

### 2. `lib/constants/roles.ts` — *compiler-forced*

```ts
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  ADMIN: 'מנהל מערכת',
  SYSTEM_MANAGER: 'מנהל',
  AREA_MANAGER: 'מנהל אזור',   // build fails without this
};
```

Also place it in `ROLE_HIERARCHY` (weakest → strongest) and add it to
`ASSIGNABLE_ROLES` if it should be offered in the invite dialog.

### 3. `lib/constants/permissions.ts` — *compiler-forced*

```ts
export const HOME_PAGES: Record<UserRole, string> = {
  ADMIN: '/app/home',
  SYSTEM_MANAGER: '/app/home',
  AREA_MANAGER: '/app/home',   // build fails without this
};
```

Then add the role to whichever `ROUTE_PERMISSIONS` arrays it should reach.

### 4. A new migration

```sql
ALTER TABLE public.users DROP CONSTRAINT users_app_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_app_role_check
  CHECK (app_role IS NULL OR app_role IN ('ADMIN','SYSTEM_MANAGER','AREA_MANAGER'));
```

New file under `supabase/migrations/`. **Never edit the baseline in place** —
existing tenants have already run it.

Then `npm run sync-tenant-migrations`.

Optional fifth: add the role to `roles: [...]` on the nav items it should see.

## Why the maps are total

`ROLE_DISPLAY_NAMES` and `HOME_PAGES` are declared `Record<UserRole, …>`, not
`Partial`. Adding a member to `USER_ROLES` breaks the build until both are
filled in. That is deliberate: a role that exists but has no landing page and
no label is a role that fails at runtime, in front of a user.

## `null` is not a role

`app_role IS NULL` means "signed up, awaiting approval". It is the normal state
after a self-registration, not an error:

- `/auth/callback` inserts new users with `app_role: null`
- `getEffectiveHomePage(null)` returns `/app/pending-approval`
- `requireApproved()` rejects with "החשבון ממתין לאישור מנהל"

Do not invent a `PENDING` role. NULL already carries that meaning, and adding
one would put a non-role into every `Record<UserRole, …>`.

## Enforcement, in layers

| Layer | Where | Protects |
|---|---|---|
| proxy | `proxy.ts` | anonymous users, coarsely |
| client route guard | `ProtectedAppLayoutClient.tsx` | UX — no dead-end pages |
| nav filter | `Sidebar.tsx` | UX — no unusable links |
| **API route** | `requireRoles(auth, [...])` | **real** |
| **RLS** | tenant DB policies | **real** |

Only the bottom two are security. Never rely on a hidden button.

```ts
const supabase = await createClient();
const auth = await getAuthInfo(supabase);

const denied = requireRoles(auth, TENANT_ADMIN_ROLES);
if (denied) return denied;
```

Use the named lists from `lib/constants/roles.ts` — `SUPER_ROLES`,
`TENANT_ADMIN_ROLES`, `ASSIGNABLE_ROLES` — never an inline string array. When a
role is added, updating one list updates every route that uses it.

**Routes that manage the platform, not the tenant** — anything under
`/api/admin/tenants/**` — use `requirePlatformOperator(auth)` instead. It runs
the role check *and* an allow-list check, because `ADMIN` is a role every
customer's own administrator holds:

```ts
const denied = requirePlatformOperator(auth);
if (denied) return denied;
```

See `lib/auth/platform.ts` and `docs/features/tenant-admin.md`.

## The hierarchy rule

`canManageRole(actor, target)` — you cannot assign, edit, or delete a role above
your own. With two roles this only stops a SYSTEM_MANAGER from minting an
ADMIN, but it is written against the hierarchy so it keeps holding as roles are
added. Apply it in any route that writes `app_role`.

Two self-protection rules the API enforces:
- you cannot change your own role
- you cannot deactivate or delete yourself

## RLS

Policies go through two helpers rather than inlining role lists:

```sql
CREATE FUNCTION public.current_app_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_role FROM public.users WHERE id = auth.uid() AND is_active
$$;

CREATE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT public.current_app_role() IN ('ADMIN', 'SYSTEM_MANAGER')
$$;
```

`SECURITY DEFINER` with a pinned `search_path` is required: without it, reading
`public.users` from inside a policy **on** `public.users` recurses.

Write new policies as:

```sql
CREATE POLICY "invoices_manage" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

## Open item to revisit

`users_select_all` lets any authenticated user read every row of `public.users`,
including emails and phone numbers. Acceptable for a two-role admin tool.

**The moment you add a low-privilege role, narrow that policy.** It is the first
thing to check, because nothing will fail loudly.

## Checklist

- [ ] All four files updated; build is green
- [ ] Role placed correctly in `ROLE_HIERARCHY`
- [ ] Constraint widened in a NEW migration, then synced
- [ ] Route guards use named role lists, not inline arrays
- [ ] `canManageRole` applied wherever `app_role` is written
- [ ] RLS policies go through `is_admin()` / `current_app_role()`
- [ ] `users_select_all` reconsidered if the new role is low-privilege
