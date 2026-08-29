---
name: multi-tenant
description: How a request resolves to a tenant, which of the five Supabase clients to use, and the rules for the encrypted tenant credentials. Always use when touching proxy.ts, lib/supabase/*, lib/tenant/*, or any /api/admin/tenants route.
---

# Multi-tenancy

One Supabase project per tenant, plus one master project holding the registry.
Isolation is **physical**, not row-level — there is no `tenant_id` column
anywhere, because two tenants' data never share a database.

## The request path

```
Host: acme.example.app
  │
  ├─ proxy.ts  extractSubdomain()            → "acme"
  ├─           getConnectionWithCache()      → master DB (5-min cache)
  ├─           decryptMaybe(anon_key)        → AES-GCM open
  ├─           inject 4 request headers
  ├─           supabase.auth.getUser()       → refresh session on acme's project
  └─           redirect if anonymous
      │
      ▼
  /api/*  →  lib/supabase/server.ts  →  acme's database only
```

`extractSubdomain` precedence: `?tenant=` override → `*.localhost` → tunnel →
`*.vercel.app` (only if `DEFAULT_PREVIEW_TENANT` is set) → suffix match against
`NEXT_PUBLIC_BASE_DOMAIN`.

The suffix match is in `lib/constants/domain.ts` and matches against the base
domain rather than counting dots — that is what makes `example.co.il` work.

## Only four headers

`x-tenant-id`, `x-tenant-subdomain`, `x-supabase-url`, `x-supabase-anon-key`.

Everything mutable — logo, module set, legal copy — is read fresh from the
registry by `/api/users/me` and `/api/tenant/settings`. Two reasons:

1. **Freshness.** An admin's change shows up on the next request instead of
   after a cache TTL.
2. **Header size.** Stuffing settings into headers is how you end up needing
   `--max-http-header-size` on every dev and start script.

**Do not add a fifth header** to carry configuration. Read it from the registry.

## What is cached, and what is not

`lib/tenant/cache.ts` caches `TenantConnection` only: id, subdomain, status,
URL, anon key. All effectively immutable.

`settings` is deliberately NOT cached. If you need it, call `getTenantById`.

Residual staleness: suspending a tenant, or rotating its keys, can take up to
5 minutes to take effect, and on serverless each instance holds its own copy —
`invalidateTenantCache` only clears the instance that served the write.
Redeploy if you need it enforced everywhere at once.

## The five Supabase clients

| File | Target | Auth | Use it when |
|---|---|---|---|
| `lib/supabase/server.ts` | tenant | user session | **default for every API route** |
| `lib/supabase/service.ts` | tenant | service role | RLS genuinely cannot express it |
| `lib/supabase/master-client.ts` | master | service role | registry reads/writes |
| `lib/supabase/client.ts` | tenant | anon, browser | session listener, OAuth |
| `lib/supabase/tenant/local.ts` | — | — | local-dev bypass helper |

Reaching for `service.ts` means RLS is off. Write a comment saying why.
`createServiceClientForTenant(id)` is for cross-tenant work only — never derive
the id from user input on a tenant-scoped request; use the header.

## Encrypted credentials

Both Supabase keys are stored as AES-256-GCM envelopes in the registry:

```
v1.<keyVersion>.<base64url iv>.<base64url ciphertext||tag>
```

- Key: `TENANT_SECRETS_KEY`, 32 bytes base64. Losing it means every stored
  credential is unreadable.
- AAD is `${subdomain}:${column}` — a ciphertext copied to another tenant's row,
  or to the other key column, fails to open instead of silently working.
  **This is why the subdomain is immutable.**
- WebCrypto, not `node:crypto`: the proxy decrypts on every request and may run
  on Edge.
- `decryptMaybe` passes plaintext through, so an existing registry can be
  encrypted in place with `npm run secrets:encrypt` while the app serves.

### What this does and does not protect

Protects: a dump, backup, or read replica of the master database.

Does **not** protect the anon key from the browser — the proxy injects it and
`TenantProvider` publishes it on `window`, by design. It is the same
publishable key a single-tenant app ships in its bundle.

The service-role key never leaves the server.

## Never return a key to the browser

Every handler under `app/api/admin/tenants/**` declares its response as
`TenantPublic` (`lib/tenant/serialize.ts`), which has:

```ts
supabase_anon_key_masked: string;   // "sb_publ…4f2a"
has_service_role_key: boolean;
```

Returning a raw `Tenant` is a **compile error**, not a silent leak. Do not widen
the return type to make something compile.

The admin edit form treats keys as write-only: the fields render empty, and an
empty submission means "leave the stored key alone".

## Local development

Two modes:

| Mode | Setup | Behaviour |
|---|---|---|
| `USE_LOCAL_DB=true` | one local Supabase stack | it is BOTH the master and the tenant; the registry resolves normally |
| registry bypass | `LOCAL_TENANT_*` vars, `USE_LOCAL_DB` unset | points at one remote project directly, no registry |

In bypass mode the tenant id is the synthetic `local-tenant`; code that needs
the registry checks `isLocalTenant(tenantId)` and degrades gracefully.

## Checklist

- [ ] No new `x-tenant-*` header carrying configuration
- [ ] Mutable tenant data read via `getTenantById`, not from the cache
- [ ] Admin tenant responses typed `TenantPublic`
- [ ] Service client used only where RLS cannot work, with a comment
- [ ] No hardcoded domain — everything through `lib/constants/domain.ts`
- [ ] Subdomain treated as immutable
