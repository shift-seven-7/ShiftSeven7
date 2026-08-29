---
name: modules
description: How to add a feature module — the five edit points, the flag resolution pipeline, and the per-tenant toggle matrix. Always use when adding a new feature area, or when touching lib/constants/features.ts.
---

# Modules

A module is a feature area a tenant can have or not have. The registry ships
**empty** — every mechanism around it is already wired, so adding one is five
edits and no new plumbing.

## The five edit points

Adding an "invoices" module:

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

`getFeatureFlags()` is what populates the admin toggle matrix — the row appears
there with no change to any component.

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

Then build `app/app/invoices/`, `app/api/invoices/`, and a migration for its
tables. Enable it per tenant at `/app/admin/tenants/[id]` → "הגדרות לקוח".

## How a flag resolves

Three layers, intersected. Merged in `app/api/users/me/route.ts`:

```
1. tenants.settings.features       master DB — what the tenant bought
      ∩
2. tenant_feature_defaults         tenant DB — what its admin left on
      ∩
3. users.features_override         tenant DB — per-user opt-out
```

- **Layer 1 absent means "everything in the registry."** That is the default for
  a new tenant, and it is why adding a module does not silently switch it off
  for existing tenants.
- **Super roles bypass layers 2 and 3.** An ADMIN always sees the full package.
- Layers 2 and 3 can only take away. Neither can grant something outside the
  package.

## Where the flag is enforced

| Layer | File | Effect |
|---|---|---|
| route | `app/app/ProtectedAppLayoutClient.tsx` via `ROUTE_FEATURES` | redirect to the home page |
| nav | `components/layout/Sidebar.tsx` via `feature:` | item hidden |
| component | `usePermissions().isFeatureEnabled(key)` | conditional render |
| **server** | the route's own check | **the one that matters** |

The first three are UX. A module's API routes must still verify entitlement
server-side — hiding a nav item protects nothing.

## Sub-features

A flag with `parent` is only meaningful while its parent is on:

```ts
{ key: FEATURE_KEYS.INVOICE_REMINDERS, label: 'תזכורות', parent: FEATURE_KEYS.INVOICES }
```

`resolveFeatureSet` then applies two rules:

1. A child whose parent is off is dropped.
2. A parent that is on with **none** of its children listed gets all of them.
   That is how a newly added child key reaches tenants whose stored list
   predates it, with no data migration.

Rule 2 has a real edge: a parent deliberately left on with every child disabled
looks identical to that legacy shape, and the children come back on. If you
mean "none of it", disable the parent.

**Do not add a `parent` to an existing standalone module.** Every tenant that
already has the parent would silently gain the child.

## Empty-registry behaviour

With `FEATURE_KEYS = {}`:

- `FeatureKey` falls back to `string`, so feature-typed code still compiles
- `getRequiredFeatures()` returns null for every route — guards are no-ops
- The admin matrix renders "לא הוגדרו מודולים במערכת"

Nothing needs changing to turn the first module on.

## Checklist

- [ ] Key, descriptor, and `ROUTE_FEATURES` entry all added
- [ ] Nav item carries `feature:`
- [ ] `ROUTE_PERMISSIONS` entry added for the route
- [ ] The module's API routes check entitlement server-side
- [ ] Sub-features: parent chosen deliberately, existing modules untouched
- [ ] Module tables live in their own migration, not the baseline
