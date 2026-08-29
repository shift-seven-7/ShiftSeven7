# Sign-in methods

How people prove who they are is a **deployment** decision, not a code one. One
project ships email + password, the next ships SMS codes, and neither should
have to edit the login screen, the API routes or the provisioning wizard to get
there.

```
NEXT_PUBLIC_AUTH_METHODS=password
        │
        ▼
lib/auth/methods.ts  ── descriptors ──┬──► components/auth/LoginMethods.tsx
   (client-safe)                      │       what the login screen renders
                                      │
lib/auth/server/registry.ts ──────────┼──► app/api/auth/[method]/start|verify
   (handlers)                         │       what the server accepts
                                      │
                                      └──► provisioning step 4
                                              which providers a new tenant
                                              project is configured with
```

---

## Choosing

One env var, comma-separated. Unset means `password`.

```bash
NEXT_PUBLIC_AUTH_METHODS=password
NEXT_PUBLIC_AUTH_METHODS=password,google
NEXT_PUBLIC_AUTH_METHODS=phone_otp
```

`NEXT_PUBLIC_` because the login screen renders from it. That is safe — the
list of *offered* methods is not a secret, and the server re-checks it on every
request rather than trusting what arrived from the browser. An unknown or empty
value falls back to `password` with a warning, because a login screen with no
way in is worse than the wrong way in.

> A `NEXT_PUBLIC_` variable is inlined at build time. Changing this in Vercel
> needs a **redeploy**, not just a restart.

| Id | State | Needs |
|---|---|---|
| `password` | works | nothing |
| `google` | works | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, a Google Cloud project |
| `email_otp` | **placeholder** | nothing external — the cheapest one to finish |
| `phone_otp` | **placeholder** | a paid SMS provider |

A placeholder is not a stub that silently does nothing. Enabling one renders it
on the login screen in a disabled state, and the server answers **501** with the
exact next step. Half-configured fails loudly.

---

## What each method controls

| Concern | Where it comes from |
|---|---|
| Label on the login screen | `descriptor.label` |
| Which form renders | `descriptor.kind` — `credentials`, `oauth` or `otp` |
| Which column identifies the user | `descriptor.identifier` — `email` or `phone` |
| Whether people can self-register | `descriptor.supportsSignUp` |
| Whether "forgot password" exists | `isPasswordEnabled()` |
| What an admin invites by | `getInviteChannels()` |
| Provider config on a new tenant project | `handler.configureProject()` |

Nothing else in the codebase branches on the method. If you find yourself
writing `if (method === 'password')` outside `lib/auth/`, the registry is
missing a field.

---

## Implementing a method — the five seams

Worked through with `phone_otp`, the harder of the two placeholders. The code
sketches are already in `lib/auth/server/phone-otp.ts`, commented out.

### 1. Choose it

```bash
NEXT_PUBLIC_AUTH_METHODS=phone_otp
```

Nothing to write. `components/auth/methods/OtpForm.tsx` already renders a
two-step form for any method whose `kind` is `otp`, and picks the keyboard and
the icon from `descriptor.identifier`.

### 2. Implement `start` and `verify`

`lib/auth/server/phone-otp.ts`. Supabase generates, stores and expires the code;
you are only calling it.

```ts
// start — send
const { error } = await ctx.supabase.auth.signInWithOtp({
  phone,                                        // E.164: +9725...
  options: { shouldCreateUser: input.mode === 'sign-up' },
});
if (error) throw new AuthMethodError('שליחת הקוד נכשלה. נסה שוב.');
return { outcome: 'pending_verification', channel: 'phone' };

// verify — check
const { data, error } = await ctx.supabase.auth.verifyOtp({
  phone, token: input.code, type: 'sms',
});
if (error || !data.user) throw new AuthMethodError('הקוד שגוי או שפג תוקפו', 401);
await ensureUserProfile(ctx.supabase, data.user);
return { outcome: 'session' };
```

Then set `implemented: true` in `lib/auth/methods.ts`.

Two rules the existing methods follow and a new one should too:

- **Stay vague on failure.** "No such number" versus "wrong code" turns the form
  into an enumeration oracle. `password` is deliberately vague for the same
  reason.
- **Check `is_active` after authenticating.** Supabase knows nothing about it,
  so a deactivated user can still get a session. Copy the block from
  `password.ts`.

### 3. The SMS provider

The part that costs money and takes days, not minutes.

1. Open a Twilio / Vonage / MessageBird account
2. Register a sender — Israeli numbers need an approved alphanumeric sender ID
   or a local long code, and approval is not instant
3. Set the env vars and fill in `configureProject`:

```ts
config.external_phone_enabled = true;
config.sms_provider = process.env.SMS_PROVIDER;
config.sms_twilio_account_sid = process.env.SMS_TWILIO_ACCOUNT_SID;
config.sms_twilio_auth_token = process.env.SMS_TWILIO_AUTH_TOKEN;
config.sms_twilio_message_service_sid = process.env.SMS_TWILIO_MESSAGE_SERVICE_SID;
```

Provisioning step 4 then configures every **new** tenant project automatically.
Tenants created before that keep their old config — re-run the step for each of
them from `/app/admin/tenants/[id]/setup`.

> A per-tenant provider (each customer sending from their own sender ID) belongs
> in the encrypted secrets bag, not in env: `setTenantSecret(tenantId,
> 'sms_twilio_auth_token', …)`. See [multi-tenant.md](../multi-tenant.md).

### 4. Local development

`supabase/config.toml` ships with SMS off:

```toml
[auth.sms]
enable_signup = false

[auth.sms.twilio]
enabled = false
```

Turn them on, or add a `[auth.sms.test_otp]` entry to sign in with a fixed code
and no provider at all — which is what you want for day-to-day work. Restart
with `npm run db:stop && npm run db:start`; config.toml is read at container
start.

### 5. Invitations

`app/api/users/invite/route.ts` already asks `getInviteChannels()` what it may
invite by, and `InviteUserDialog` already renders a phone field instead of an
email one when that is the answer. Both start working the moment the method is
`implemented: true`. Nothing to change.

---

## What is *not* a seam

**The identity schema.** `public.users.email` is nullable, `phone` is unique,
and a row must carry at least one of the two:

```sql
CONSTRAINT users_identity_present CHECK (email IS NOT NULL OR phone IS NOT NULL)
```

This is in the baseline on purpose. A phone-only account is representable
today, before anyone implements phone sign-in — because widening that column
after tenants exist means a migration against every tenant database, and
`ensureUserProfile` writing `user.email!` would have inserted an empty identity
long before anyone noticed.

Nothing renders `user.email` directly for the same reason; use
`identityLabel(email, phone)` from `lib/utils.ts`.

---

## Adding a method the registry does not know about

Passkeys, SAML, a corporate IdP:

1. Add the id to `AuthMethodId` in `lib/auth/types.ts`
2. Add a descriptor to `AUTH_METHODS` in `lib/auth/methods.ts`
3. Add a handler under `lib/auth/server/` and register it in
   `lib/auth/server/registry.ts` — both maps are `Record<AuthMethodId, …>`, so
   the build fails until you do
4. If `kind` is not one of the three existing shapes, add a component and a
   branch in `components/auth/LoginMethods.tsx`

Steps 1–3 are compiler-enforced. Step 4 is the only judgement call.
