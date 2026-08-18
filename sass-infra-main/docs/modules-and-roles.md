# Modules and roles

The two extension points. Everything domain-specific enters through one of them.

---

# Modules

A module is a feature area a tenant can have or not have. The registry
(`lib/constants/features.ts`) ships **empty** with the full pipeline already
wired.

## Adding one — five edits

Example: an "invoices" module.

### 1-3. `lib/constants/features.ts`

```ts
export const FEATURE_KEYS = {
  INVOICES: 'invoices',
} as const;

export function getFeatureFlags(): FeatureFlag[] {
  return [
    {
      key: FEATURE_KEYS.INVOICES,
      label: 'חשבוניות',
      description: 'הפקה וניהול של חשבוניות ללקוחות',
    },
  ];
}

export const ROUTE_FEATURES: Record<string, FeatureKey | FeatureKey[]> = {
  '/app/invoices': FEATURE_KEYS.INVOICES,
};
```

The descriptor is what makes the module appear in the admin toggle matrix — no
component change needed.

### 4. `components/layout/Sidebar.tsx`

```ts
{
  href: '/app/invoices',
  label: 'חשבוניות',
  icon: Receipt,
  roles: ALL_ROLES,
  feature: FEATURE_KEYS.INVOICES,
}
```

### 5. `lib/constants/permissions.ts`

```ts
ROUTE_PERMISSIONS['/app/invoices'] = [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_MANAGER];
```

Then build `app/app/invoices/`, `app/api/invoices/`, and a migration for the
module's tables. Enable it per tenant at `/app/admin/tenants/[id]` →
"הגדרות לקוח".

## Resolution

```
1. tenants.settings.features     master DB   what the tenant bought
        ∩
2. tenant_feature_defaults       tenant DB   what its admin left on
        ∩
3. users.features_override       tenant DB   per-user opt-out
```

Merged in `app/api/users/me/route.ts`, consumed via `usePermissions()`.

- **Layer 1 absent = everything.** The default for a new tenant, and the reason
  a newly added module reaches existing tenants with no data migration.
- **Super roles bypass layers 2 and 3.**
- Layers 2 and 3 subtract only; neither grants anything outside the package.

## Enforcement

| Layer | Where | Real security? |
|---|---|---|
| route redirect | `ProtectedAppLayoutClient` via `ROUTE_FEATURES` | no |
| nav item hidden | `Sidebar` via `feature:` | no |
| conditional render | `isFeatureEnabled(key)` | no |
| API route check | the module's own routes | **yes** |

The module's API routes must verify entitlement themselves.

## Sub-features

```ts
{ key: FEATURE_KEYS.INVOICE_REMINDERS, label: 'תזכורות', parent: FEATURE_KEYS.INVOICES }
```

`resolveFeatureSet` applies two rules:

1. A child whose parent is off is dropped.
2. A parent that is on with **none** of its children listed gets all of them —
   how a newly added child reaches tenants whose stored list predates it.

Rule 2's edge: a parent deliberately on with every child off is indistinguishable
from that legacy shape, and the children come back. Disable the parent instead.

**Never add `parent` to an existing standalone module** — every tenant holding
the parent would silently gain the child.

---

# Roles

Fixed in code. Ships with `ADMIN` and `SYSTEM_MANAGER`.

## Adding one — four files

### 1. `types/roles.ts`

```ts
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  SYSTEM_MANAGER: 'SYSTEM_MANAGER',
  AREA_MANAGER: 'AREA_MANAGER',
} as const;
```

### 2. `lib/constants/roles.ts` — *build fails without this*

```ts
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  ADMIN: 'מנהל מערכת',
  SYSTEM_MANAGER: 'מנהל',
  AREA_MANAGER: 'מנהל אזור',
};
```

Plus its position in `ROLE_HIERARCHY` (weakest → strongest) and, if it should be
invitable, `ASSIGNABLE_ROLES`.

### 3. `lib/constants/permissions.ts` — *build fails without this*

```ts
export const HOME_PAGES: Record<UserRole, string> = {
  ADMIN: '/app/home',
  SYSTEM_MANAGER: '/app/home',
  AREA_MANAGER: '/app/home',
};
```

Plus the `ROUTE_PERMISSIONS` arrays it should reach.

### 4. A new migration

```sql
ALTER TABLE public.users DROP CONSTRAINT users_app_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_app_role_check
  CHECK (app_role IS NULL OR app_role IN ('ADMIN','SYSTEM_MANAGER','AREA_MANAGER'));
```

Never edit the baseline in place — existing tenants already ran it. New file,
then `npm run sync-tenant-migrations`.

## Why the maps are total

Declared `Record<UserRole, …>`, not `Partial`. A role with no landing page and
no label fails at runtime in front of a user; making it fail at build time
instead is the whole point.

## `null` is not a role

`app_role IS NULL` = "signed up, awaiting approval". Normal after a
self-registration. `getEffectiveHomePage(null)` returns `/app/pending-approval`;
`requireApproved()` rejects with a specific message.

Do not add a `PENDING` role — NULL already means it, and a pseudo-role would
have to be described in every `Record<UserRole, …>`.

## Enforcement

| Layer | Where | Real security? |
|---|---|---|
| proxy | `proxy.ts` | anonymous only |
| client route guard | `ProtectedAppLayoutClient` | no |
| nav filter | `Sidebar` | no |
| **API route** | `requireRoles(auth, [...])` | **yes** |
| **RLS** | tenant DB policies | **yes** |

```ts
const auth = await getAuthInfo(supabase);
const denied = requireRoles(auth, TENANT_ADMIN_ROLES);
if (denied) return denied;
```

Use the named lists in `lib/constants/roles.ts` — `SUPER_ROLES`,
`TENANT_ADMIN_ROLES`, `ASSIGNABLE_ROLES`. Updating one list then updates every
route that uses it.

## The hierarchy rule

`canManageRole(actor, target)`: you cannot assign, edit, or delete a role above
your own. Apply it in any route that writes `app_role`.

The API also enforces two self-protection rules: you cannot change your own
role, and you cannot deactivate or delete yourself.

## RLS

```sql
CREATE POLICY "invoices_manage" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

`public.is_admin()` and `public.current_app_role()` are the only place a role
list appears in SQL. `current_app_role()` is `SECURITY DEFINER` with a pinned
`search_path` — without that, reading `public.users` from a policy **on**
`public.users` recurses.

## Open item

`users_select_all` lets any authenticated user read every row of `public.users`,
emails included. Fine for a two-role admin tool.

**Narrow it the moment a low-privilege role is added.** Nothing will fail
loudly, so it has to be checked deliberately.
