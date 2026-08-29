# אימות והרשמה (Auth)

## Overview

Authentication runs against the **current tenant's own** Supabase project. Auth
users are per tenant — the same person on two tenants is two accounts in two
projects. There is no cross-tenant identity.

*Which* methods are offered is a deployment setting, `NEXT_PUBLIC_AUTH_METHODS`,
not something this page hard-codes. Email + password is the default and the only
one that needs no setup. See [auth-methods.md](auth-methods.md) for the registry
and for implementing a new method.

A new self-registration lands with no role and waits for an admin.

## Pages & Routes

| Route | Purpose |
|---|---|
| `/auth/login` | renders the enabled methods, `?disabled=1` banner |
| `/auth/sign-up` | self-registration, through the methods that support it |
| `/auth/sign-up-success` | "check your email" |
| `/auth/forgot-password` | request a reset link — only when `password` is enabled |
| `/auth/update-password` | set a new password (session already established by the link) |
| `/auth/error` | expired or reused link |
| `/auth/callback` | OAuth / email-confirmation exchange — a route handler, not a page |
| `/app/pending-approval` | where a user with no role waits |

## API Endpoints

| Endpoint | Method | Notes |
|---|---|---|
| `/api/auth/[method]/start` | POST | sign-in or sign-up (`mode`), dispatched through the registry |
| `/api/auth/[method]/verify` | POST | second step of an OTP method |
| `/api/auth/logout` | POST | |
| `/api/auth/forgot-password` | POST | always 200 — no account enumeration. 404 without `password` |
| `/api/auth/update-password` | POST | requires a session. 404 without `password` |

`start` answers **404** for a method this deployment does not offer — confirming
that phone sign-in exists is information a stranger does not need — and **501**
for one that is enabled but not implemented, with the next step as the message.

`start` returns one of four outcomes, and the client acts on it:
`session` (navigate home) · `redirect` (navigate to a provider) ·
`pending_verification` (collect a code) · `pending_confirmation` (check your inbox).

## Data Flow

```
password → POST /api/auth/password/start → signInWithPassword → is_active check
         → { outcome: 'session' }
         → window.location.href = '/' → proxy reads the session → HOME_PAGES[role]

google   → POST /api/auth/google/start → { outcome: 'redirect', url }
         → navigate → provider → /auth/callback → exchangeCodeForSession
         → profile exists? clear invited_at, land on HOME_PAGES[role]
         → no profile?     insert with app_role: null, land on /app/pending-approval

otp      → POST /api/auth/<m>/start  → { outcome: 'pending_verification' }
         → POST /api/auth/<m>/verify → { outcome: 'session' }
```

Login and password update navigate with `window.location.href`, not
`router.push`: the proxy must see the new session cookies to compute the landing
page.

## Key Files

| File | Role |
|---|---|
| `lib/auth/methods.ts` | the registry — descriptors, client-safe |
| `lib/auth/server/registry.ts` | id → handler, and the provisioning config hook |
| `lib/auth/server/*.ts` | one file per method |
| `app/api/auth/[method]/*` | the two generic endpoints |
| `components/auth/LoginMethods.tsx` | renders the enabled methods |
| `app/auth/callback/route.ts` | the code exchange and profile upsert |
| `lib/api/auth.ts` | `getAuthInfo`, `requireRoles`, `requireApproved` |
| `lib/auth/platform.ts` | `requirePlatformOperator` — the registry console gate |
| `proxy.ts` | session refresh, anonymous redirect |

## Design notes

**Why the callback builds a second Supabase client.** After the exchange it
creates one bound to the fresh access token, so the profile read and insert run
through RLS as that user rather than anonymously.

**Why cookies are collected, not written.** The final redirect response does not
exist yet when Supabase emits session cookies; writing them to a response that
is later replaced silently loses the session.

**Why errors are vague.** "אימייל או סיסמה שגויים" rather than "no such user" —
a specific message turns the login form into an account-enumeration oracle. Same
reason `/api/auth/forgot-password` always answers 200.

**Why `?next=` is checked for a leading slash.** An absolute value would make
the callback an open redirect.

**Why identity is either-or.** `public.users.email` is nullable and `phone` is
unique, with a check that at least one is present. A phone-OTP deployment
creates accounts that never had an email address; requiring one would hard-code
a single sign-in method into the schema. Render `identityLabel(email, phone)`,
never `user.email`.

## Related

- [auth-methods.md](auth-methods.md) — the registry, and how to implement a method
- [multi-tenant.md](../multi-tenant.md) — how the tenant is resolved before any of this runs
- [users.md](users.md) — assigning a role to a pending user
