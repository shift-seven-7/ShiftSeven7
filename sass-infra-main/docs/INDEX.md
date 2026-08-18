# Documentation Index

The map. Start here before touching anything.

## How to use this index

| You are… | Read |
|---|---|
| setting up to work on this locally | `getting-started.md` |
| putting it live for the first time | `deployment.md` |
| about to change a page | the **Page Map** below → the feature docs it lists |
| adding a feature area | `modules-and-roles.md`, then the `modules` skill |
| touching tenants, auth, or Supabase clients | `multi-tenant.md` |
| writing a migration | `migrations.md` |
| orienting for the first time | `architecture.md` |

## Guides

| Doc | Covers |
|---|---|
| [getting-started.md](getting-started.md) | local setup, seeding demo tenants, navigating between them, creating one from the console |
| [deployment.md](deployment.md) | accounts, domain and wildcard DNS, Frankfurt in both layers, env vars, the first tenant |

## System docs

| Doc | Covers |
|---|---|
| [architecture.md](architecture.md) | stack, the two databases, auth, roles, storage, design system |
| [multi-tenant.md](multi-tenant.md) | tenant resolution, the five Supabase clients, credential encryption |
| [modules-and-roles.md](modules-and-roles.md) | the add-a-module and add-a-role recipes |
| [migrations.md](migrations.md) | multi-tenant migration workflow |
| [provisioning.md](provisioning.md) | the two onboarding paths and the eight setup steps |

## Feature docs

`features/` holds one doc per feature. The infrastructure ships with five.

| Feature | Doc | Description |
|---|---|---|
| אימות והרשמה | [features/auth.md](features/auth.md) | login, signup, password reset, the pending-approval state |
| שיטות התחברות | [features/auth-methods.md](features/auth-methods.md) | the method registry, choosing per deployment, implementing a placeholder |
| משתמשים והרשאות | [features/users.md](features/users.md) | the directory, invites, role assignment, deactivation |
| הגדרות מערכת | [features/settings.md](features/settings.md) | the tenant settings tab shell and the appearance tab |
| ניהול טננטים | [features/tenant-admin.md](features/tenant-admin.md) | the registry console, client settings, the setup wizard |

A new module adds its own doc here and a row to this table.

## Page Map

Route → the docs to read before changing it.

### `/auth/*` — אימות
| Page | Doc |
|---|---|
| `/auth/login`, `/auth/sign-up` | [auth](features/auth.md), [auth-methods](features/auth-methods.md) |
| `/auth/forgot-password`, `/auth/update-password` | [auth](features/auth.md) |
| `/auth/callback` | [auth](features/auth.md), [multi-tenant](multi-tenant.md) |
| adding or changing a sign-in method | [auth-methods](features/auth-methods.md) |

### `/app/home` — עמוד הבית
Placeholder. Replace the card in `app/app/home/page.tsx`; the route, nav entry
and permission wiring already exist.

### `/app/users` — משתמשים
| Section | Doc |
|---|---|
| directory, invite, edit, delete | [users](features/users.md) |
| role rules | [modules-and-roles](modules-and-roles.md) |

### `/app/settings` — הגדרות מערכת
| Tab | Doc |
|---|---|
| עיצוב ומראה | [settings](features/settings.md) |
| adding a tab | [settings](features/settings.md), [modules-and-roles](modules-and-roles.md) |

### `/app/profile` — הפרופיל שלי
| Section | Doc |
|---|---|
| name, phone, avatar | [users](features/users.md) |

### `/backoffice` — ניהול הפלטפורמה
| Page | Doc |
|---|---|
| operator sign-in, tenant list, provisioning | [tenant-admin](features/tenant-admin.md), [provisioning](provisioning.md) |

### `/app/admin/tenants` — ניהול טננטים
| Page / tab | Doc |
|---|---|
| list, manual registration | [tenant-admin](features/tenant-admin.md) |
| who may reach any of it | [tenant-admin](features/tenant-admin.md) — the platform-operator gate |
| `[id]` → פרטי טננט | [tenant-admin](features/tenant-admin.md), [multi-tenant](multi-tenant.md) |
| `[id]` → הגדרות לקוח | [tenant-admin](features/tenant-admin.md), [modules-and-roles](modules-and-roles.md) |
| `[id]` → תנאי שימוש | [tenant-admin](features/tenant-admin.md) |
| `[id]/setup`, `new-automated` | [provisioning](provisioning.md) |

## Issues

`issues/` holds one markdown file per bug discovered but not fixed, named after
the symptom. Written during step 6 of the workflow, so that finding a bug while
doing something else does not turn into an unplanned detour.
