import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Makes sure a signed-in auth user has a row in `public.users`.
 *
 * ── WHY THIS IS SHARED ───────────────────────────────────────────────────────
 * There are two ways a user first arrives, and they take different paths:
 *
 *   · email confirmation ON  → the link lands on /auth/callback, which
 *     exchanges the code and creates the profile.
 *   · email confirmation OFF → `signUp` returns a session immediately and
 *     /auth/callback never runs.
 *
 * Without a profile row `getAuthInfo` returns null, so the user is
 * authenticated and simultaneously locked out of every API route. Both entry
 * points call this, so neither can drift from the other.
 *
 * The row is created with `app_role: null` — "signed up, awaiting approval".
 * Granting a role here would let anyone self-provision access.
 *
 * ── IDENTIFIERS ──────────────────────────────────────────────────────────────
 * Whichever identifiers the auth user actually has get copied across. An OAuth
 * or password account has an email; a phone-OTP account has a phone and no
 * email at all. Writing `user.email!` would insert an empty identity for the
 * latter and trip the `users_identity_present` check.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient<Database>,
  user: User
): Promise<void> {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) return;

  const metadata = user.user_metadata ?? {};

  const email = user.email?.trim().toLowerCase() || null;
  const phone = user.phone?.trim() || null;

  if (!email && !phone) {
    // Nothing to identify them by — the insert would fail on
    // `users_identity_present` anyway, with a far less useful message.
    console.error('[auth] auth user has neither email nor phone:', user.id);
    throw new Error('יצירת פרופיל המשתמש נכשלה');
  }

  const { error } = await supabase.from('users').insert({
    id: user.id,
    email,
    phone,
    full_name:
      (metadata.full_name as string | undefined) ??
      (metadata.name as string | undefined) ??
      null,
    avatar_url: (metadata.avatar_url as string | undefined) ?? null,
    app_role: null,
    is_active: true,
  });

  // A duplicate key means a concurrent request won the race — that is success,
  // not failure.
  if (error && error.code !== '23505') {
    console.error('[auth] failed to create profile:', error.message);
    throw new Error('יצירת פרופיל המשתמש נכשלה');
  }
}
