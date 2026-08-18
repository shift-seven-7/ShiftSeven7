---
name: dev-implement
description: Implementation guidelines. Follow module flags, permissions, and all coding skills during development. Always use during step 3 of the dev workflow.
---

# Implementation

Step 3 of the workflow. The plan is approved; now write the code.

## Before writing a line

Read the skills that apply to what you are building:

| Building | Read |
|---|---|
| anything | `code-reuse`, `code-standards` |
| a page | `design-system`, `data-table-pages` |
| a dialog | `form-dialogs`, `confirmation-dialogs` |
| data access | `tanstack-query` |
| a new module | `modules` |
| a new role | `roles-permissions` |
| a migration | `migrations` |
| anything touching tenants | `multi-tenant` |

## Module flags

A feature that is not part of the core infrastructure belongs behind a module
flag. Register it in `lib/constants/features.ts` — see the `modules` skill for
the five edit points.

Gate it in three places, and no more:

```ts
// 1. the route — declarative, in features.ts
ROUTE_FEATURES['/app/invoices'] = FEATURE_KEYS.INVOICES;

// 2. the nav item — declarative, in Sidebar.tsx
{ href: '/app/invoices', ..., feature: FEATURE_KEYS.INVOICES }

// 3. anywhere inside a page that renders module UI
const { isFeatureEnabled } = usePermissions();
if (!isFeatureEnabled(FEATURE_KEYS.INVOICES)) return null;
```

Do NOT scatter flag checks through every component — the route guard already
stopped an unentitled user from getting there.

## Permissions

Every API route decides for itself who may call it. There is no route
middleware doing it for you:

```ts
const supabase = await createClient();
const auth = await getAuthInfo(supabase);

const denied = requireRoles(auth, TENANT_ADMIN_ROLES);
if (denied) return denied;
```

- `requireApproved(auth)` — any user with a role
- `requireRoles(auth, [...])` — specific roles
- Role lists come from `lib/constants/roles.ts`, never inline string arrays

Back every route check with an RLS policy. The route check produces a good
error message; RLS is what actually protects the data.

## Which Supabase client

| Need | Use |
|---|---|
| act as the signed-in user (the default) | `lib/supabase/server.ts` |
| legitimately bypass RLS | `lib/supabase/service.ts` |
| read or write the tenant registry | `lib/supabase/master-client.ts` |
| browser session listener | `lib/supabase/client.ts` |

If you reach for the service client, write a comment saying why RLS cannot
express the operation.

## Data fetching

- Hooks live in `hooks/queries/`, one file per entity
- Query keys come from `hooks/queries/keys.ts` — no inline arrays
- Every fetcher hits `/api/*`; the client never queries Supabase directly
- Throw on `!response.ok` so the mutation cache can surface the error

## Hebrew and RTL

- Every user-visible string is Hebrew, written inline (there is no i18n layer)
- Logical properties only: `ms-`, `me-`, `ps-`, `pe-`, `text-start`, `start-0`
- Never `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`
- Dialog footers reverse in RTL so the primary action lands on the right

## Checklist

- [ ] New feature is behind a module flag, registered in `features.ts`
- [ ] Route added to `ROUTE_PERMISSIONS` and, if gated, `ROUTE_FEATURES`
- [ ] API route starts with `getAuthInfo` + a `require*` guard
- [ ] RLS policy backs every route-level check
- [ ] Query keys from `keys.ts`; fetching through `/api/*`
- [ ] All UI text in Hebrew, all spacing in logical properties
- [ ] No `Record<string, unknown>` in a Supabase write
- [ ] New row types declared as `type`, not `interface`
- [ ] Migration is a FILE — not applied to any live database
