# הגדרות מערכת (Settings)

## Overview

Tenant-level system settings. Ships with one tab — appearance — and the tab
machinery a project extends.

## Pages & Routes

| Route | Purpose |
|---|---|
| `/app/settings` | tab shell; `?tab=` keeps the selection linkable |
| `/app/settings?tab=appearance` | theme mode and primary color |

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/users/me/preferences` | PUT | `theme_mode`, `theme_color` — validated against the allowed sets |
| `/api/system-settings` | — | not implemented yet; `system_settings` exists for a project to build on |

## Adding a tab

`SETTINGS_TABS` in `app/app/settings/page.tsx`:

```ts
{
  id: 'invoices',
  label: 'חשבוניות',
  icon: Receipt,
  component: InvoiceSettingsTab,
  roles: [USER_ROLES.ADMIN],       // optional
  feature: FEATURE_KEYS.INVOICES,  // optional
}
```

Role and module gating are applied by the shell. The tab bar hides itself when
only one tab is visible, so a project with no module settings still gets a clean
page.

## Data Model

Per-user, on `public.users`: `theme_mode`, `theme_color`.

Per-tenant key/value: `public.system_settings` (`key` PK, `value` JSONB). Read by
any authenticated user; written by admins. Unused by the infrastructure — it is
there so a module does not have to invent its own settings table.

## Key Files

| File | Role |
|---|---|
| `app/app/settings/page.tsx` | tab shell and registry |
| `components/settings/AppearanceSettingsTab.tsx` | mode + color |
| `lib/theme/theme-provider.tsx` | `next-themes` plus the runtime color presets |
| `lib/theme/colors.ts` | the presets |

## Design notes

**Why the theme choice is stored twice.** localStorage for instant application
on first paint (no flash of the wrong theme), and `public.users` so it follows
the user to another device. The provider writes both — the server write is
fire-and-forget, because a failed preference save should not surface as an
error.

**Why appearance is not admin-gated.** It is a per-user preference, not tenant
configuration. Tenant-wide branding lives in the tenant admin console instead.

## Related

- [tenant-admin.md](tenant-admin.md) — tenant-level branding and module toggles
- [modules-and-roles.md](../modules-and-roles.md) — gating a tab behind a module
