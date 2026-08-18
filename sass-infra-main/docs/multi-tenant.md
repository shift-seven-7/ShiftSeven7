# Multi-tenancy

## Resolution

```
Host: acme.example.app
  │
  ├─ proxy.ts  extractSubdomain()        "acme"
  ├─           getConnectionWithCache()  master DB, 5-minute cache
  ├─           decryptMaybe(anon_key)    AES-GCM open
  ├─           4 request headers
  ├─           auth.getUser()            session refresh on acme's project
  └─           redirect if anonymous
```

`extractSubdomain` precedence:

| Input | Result |
|---|---|
| `?tenant=acme` | `acme` — dev override, highest priority |
| `acme.localhost:3000` | `acme` |
| `localhost:3000` | `LOCAL_TENANT_SUBDOMAIN` |
| `*.ngrok-free.dev`, `*.ngrok.io` | `LOCAL_TENANT_SUBDOMAIN` |
| `*.vercel.app` | `DEFAULT_PREVIEW_TENANT`, or none |
| `acme.<BASE_DOMAIN>` | `acme` |
| `<BASE_DOMAIN>`, `www.`, `app.`, `api.`, `admin.` | none |

The production case suffix-matches against `NEXT_PUBLIC_BASE_DOMAIN` rather than
counting dots, so multi-label apexes like `example.co.il` work. All of it lives
in `lib/constants/domain.ts`.

No tenant → `/tenant-not-found` (rewrite). Suspended → `/tenant-suspended`.

## The four headers

`x-tenant-id` · `x-tenant-subdomain` · `x-supabase-url` · `x-supabase-anon-key`

Nothing else. Logo, modules, and legal copy are read fresh from the registry by
`/api/users/me` and `/api/tenant/settings`, because:

1. **Freshness** — an admin's save is visible on the next request, not after a
   cache TTL.
2. **Header size** — configuration in headers is how a codebase ends up needing
   `--max-http-header-size` on every script.

Adding a fifth header to carry configuration reintroduces both problems.

## Caching

`lib/tenant/cache.ts` caches `TenantConnection`: id, subdomain, status, URL,
anon key. Effectively immutable values.

`settings` is deliberately not cached.

**Residual staleness.** Suspending a tenant, or rotating its keys, takes up to 5
minutes. On serverless each instance holds its own map, so
`invalidateTenantCache` only clears the instance that served the write. Redeploy
to enforce immediately.

## The clients

| File | Target | Credentials | Use |
|---|---|---|---|
| `server.ts` | tenant | headers, user session | **default** for API routes |
| `service.ts` | tenant | service role from registry | only when RLS cannot express it |
| `master-client.ts` | master | env service key, singleton | registry |
| `master-auth.ts` | master | env anon key + operator session | `/backoffice` sign-in |
| `client.ts` | tenant | `window.__TENANT_CREDENTIALS__` | session listener, OAuth |
| `tenant-client` helpers | — | — | `lib/tenant/local.ts` for the dev bypass |

`master-client.ts` is the encryption boundary: every read decrypts, every write
encrypts. Callers deal in plaintext `Tenant` and never see an envelope.

## Credential encryption

```
v1.<keyVersion>.<base64url iv(12B)>.<base64url ciphertext||tag>
```

| Aspect | Choice | Why |
|---|---|---|
| Algorithm | AES-256-GCM | authenticated; tampering fails to open |
| Key | `TENANT_SECRETS_KEY`, 32 bytes base64 | one key, versioned in the envelope |
| Rotation | `TENANT_SECRETS_KEY_PREVIOUS` | both keys valid during a rotation |
| AAD | `${subdomain}:${column}` | binds ciphertext to its row and column |
| API | WebCrypto | the proxy decrypts per request and may run on Edge |

**The AAD is why the subdomain is immutable.** A ciphertext moved to another
tenant's row, or to the other key column, fails to open — which is the point,
but it also means renaming a subdomain would invalidate both stored keys. The
PATCH handler rejects the change.

### The general secrets bag

Two columns are not enough once a project stores anything else per tenant — an
SMS provider token, a payment key, an integration credential. Those would land
in `settings`, which is plaintext JSONB.

`tenants.secrets` is a JSONB column whose **values** are individually sealed
envelopes, AAD `<subdomain>:secret:<key>`, same key and same rotation:

```ts
await setTenantSecret(tenantId, 'sms_twilio_auth_token', token);
const token = await getTenantSecret(tenantId, 'sms_twilio_auth_token');
```

The bag is deliberately absent from the `Tenant` type — `hydrate()` drops it —
so no handler can leak it by spreading a row. `settings` stays plaintext and
stays readable; anything secret goes in the bag.

### Scope

Protects a dump, backup, or read replica of the master database.

Does **not** protect the anon key from the browser: the proxy injects it and
`TenantProvider` publishes it on `window`, by design. It is the same publishable
key any single-tenant Supabase app ships in its bundle. RLS is what protects
tenant data from its own users.

The service-role key never leaves the server.

### Never returning a key

`lib/tenant/serialize.ts`:

```ts
export type TenantPublic = Omit<Tenant, 'supabase_anon_key' | 'supabase_service_role_key'> & {
  supabase_anon_key_masked: string;
  has_service_role_key: boolean;
};
```

Every handler under `app/api/admin/tenants/**` declares this as its response
type. Returning a raw `Tenant` is a compile error. The admin form treats keys as
write-only — empty means "leave the stored key alone".

### Operations

```bash
npm run secrets:generate-key            # a new 32-byte key
npm run secrets:encrypt -- --dry-run    # convert plaintext rows
npm run secrets:rotate -- --dry-run     # re-seal under a new key
```

`/api/health` reports whether the configured key imports at all, so a missing or
malformed one shows up on a probe rather than on the first request.

Rotation, in order:

1. generate a new key
2. move the current value to `TENANT_SECRETS_KEY_PREVIOUS`, put the new one in
   `TENANT_SECRETS_KEY`
3. `npm run secrets:rotate -- --dry-run`, then for real
4. remove `TENANT_SECRETS_KEY_PREVIOUS`

The app keeps serving throughout — the envelope carries its version, so rows
sealed under either key open. The script is idempotent and resumable.

## Local development

| Mode | Setup | Behaviour |
|---|---|---|
| `USE_LOCAL_DB=true` | one local Supabase stack | it is both master and tenant; the registry resolves normally, so local matches production |
| registry bypass | `LOCAL_TENANT_*` set, `USE_LOCAL_DB` unset | points at one remote project, no registry |

In bypass mode the tenant id is `local-tenant`. Code that needs the registry
checks `isLocalTenant(tenantId)` and degrades rather than throwing.

## Adding a tenant

See `provisioning.md`.
