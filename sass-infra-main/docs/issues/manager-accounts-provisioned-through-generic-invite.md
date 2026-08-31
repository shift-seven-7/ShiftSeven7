# Shift7 manager accounts get provisioned through the generic invite dialog, not Shift7's own flow

**Found:** 2026-08-31 while scoping `SYSTEM_MANAGER`'s platform nav to match `STAFF`
**Severity:** low

## What happens

`demo-manager@shift7.test` and `demo-manager-2@shift7.test` (local dev accounts)
were created through the platform's generic "Invite user" dialog
(`components/features/users/InviteUserDialog.tsx`), which only offers `ADMIN`
and `SYSTEM_MANAGER` (`ASSIGNABLE_ROLES`). A Shift7 `staff` row with
`access_level: 'scheduler'` was then linked to each by hand.

That's a different, easier-to-get-wrong path than the one Shift7 itself
provides: `/api/shift7/staff/[id]/create-login`, reachable from the staff
roster page, which always sets `app_role: 'STAFF'` — the platform role
designed exactly for this (see `types/roles.ts`'s comment on `STAFF`).

## Expected

A Shift7-only user (scheduler or employee) should be provisioned through
Shift7's own "create login" flow, which produces the correct `STAFF` role
automatically. The generic invite dialog is meant for real platform operators.

## Where

- `components/features/users/InviteUserDialog.tsx` — offers `ASSIGNABLE_ROLES`
  (`ADMIN`, `SYSTEM_MANAGER`) with no indication it's the wrong tool for a
  module-scoped user
- `app/api/shift7/staff/[id]/create-login/route.ts` — the correct path,
  already sets `app_role: 'STAFF'`

## Notes

Not fixed here: the developer explicitly wants these particular accounts to
stay `SYSTEM_MANAGER` rather than being switched to `STAFF`, so
`lib/constants/permissions.ts` / `components/layout/Sidebar.tsx` were changed
instead to scope `SYSTEM_MANAGER` to its module(s) the same way `STAFF`
already is (see `docs/features/shift7.md`'s note on `ADMIN_ONLY`). That
resolves the symptom for these accounts specifically, but the underlying
invite-dialog ambiguity remains for whoever provisions the *next* module-scoped
user this way.
