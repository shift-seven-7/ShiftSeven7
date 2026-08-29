# משתמשים והרשאות (Users)

## Overview

The tenant's user directory: invite, assign a role, deactivate, delete. Also
covers the user's own profile page.

## User Roles & Access

| Action | Who |
|---|---|
| view the directory | any approved user |
| invite, edit, delete | `ADMIN`, `SYSTEM_MANAGER` (per `SUPER_ROLES`) |
| edit own profile | anyone signed in |

Layered on top: `canManageRole(actor, target)` — you cannot assign, edit, or
delete a role above your own.

## Pages & Routes

| Route | Purpose |
|---|---|
| `/app/users` | directory, search, pagination, row actions |
| `/app/profile` | own name, phone, avatar |

## API Endpoints

| Endpoint | Method | Auth |
|---|---|---|
| `/api/users` | GET | any approved user; search / role / active filters |
| `/api/users/[id]` | GET | any approved user |
| `/api/users/[id]` | PATCH | super roles + hierarchy check |
| `/api/users/[id]` | DELETE | super roles + hierarchy check |
| `/api/users/invite` | POST | super roles |
| `/api/users/me` | GET | self — identity, role, tenant, resolved modules |
| `/api/users/me` | PATCH | self — name, phone, avatar only |
| `/api/users/me/preferences` | PUT | self — theme mode and color |

## Data Model

`public.users`, one row per `auth.users` row.

| Column | Note |
|---|---|
| `app_role` | `NULL` = awaiting approval |
| `is_active` | false blocks the sign-in method and `getAuthInfo` |
| `is_managed` | created by an admin, cannot sign in independently |
| `invited_at` | cleared on first login |
| `features_override` | `{ [featureKey]: boolean }`, subtractive only |

## Hooks

`hooks/queries/useUsers.ts` — `useUsers`, `useInviteUser`, `useUpdateUser`,
`useDeleteUser`.
`hooks/queries/useMe.ts` — the bootstrap query, wrapped by `usePermissions()`.

## Key Files

| File | Role |
|---|---|
| `app/app/users/page.tsx` | the directory |
| `components/features/users/InviteUserDialog.tsx` | invite |
| `components/features/users/EditUserDialog.tsx` | edit |
| `components/features/users/DeleteUserDialog.tsx` | destructive confirm |
| `lib/constants/roles.ts` | role metadata and the hierarchy |

## Design notes

**Why the invite rolls back.** It writes twice — the auth user (service role),
then the profile. If the profile insert fails the auth user is deleted;
otherwise that email is occupied by a login with no profile and every retry
fails with "already exists". `admin_created` in provisioning follows the same
rule.

**Why there are two edit endpoints.** `PATCH /api/users/[id]` is admin-only;
`PATCH /api/users/me` is self-service and cannot touch `app_role` or `is_active`
at all. Splitting them means the admin route never reasons about "unless it's
yourself", and the fields that decide permissions are simply unreachable from
the self-service path.

**Why you cannot change your own role or deactivate yourself.** Both take effect
mid-session and can lock you out of the page you are standing on. Enforced in
the API, and disabled in the UI with an explanation.

**Why unknown `features_override` keys are dropped.** A stale client would
otherwise accumulate junk in the column that nothing ever cleans up.

## Related

- [modules-and-roles.md](../modules-and-roles.md) — adding a role
- [auth.md](auth.md) — how a user reaches the pending state
