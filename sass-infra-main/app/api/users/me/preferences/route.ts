import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { badRequest, getAuthInfo, serverError, unauthorized } from '@/lib/api/auth';
import { COLOR_PRESETS } from '@/lib/theme/colors';

/**
 * The signed-in user's own display preferences.
 *
 * Persisted so the theme follows them across devices; the client also mirrors
 * it to localStorage so there is no flash of the wrong theme on first paint.
 */

const THEME_MODES = ['light', 'dark', 'system'] as const;

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);
  if (!auth) return unauthorized();

  let body: { theme_mode?: string; theme_color?: string };
  try {
    body = await request.json();
  } catch {
    return badRequest('בקשה לא תקינה');
  }

  const patch: { theme_mode?: string; theme_color?: string } = {};

  if (body.theme_mode !== undefined) {
    if (!(THEME_MODES as readonly string[]).includes(body.theme_mode)) {
      return badRequest('מצב תצוגה לא תקין');
    }
    patch.theme_mode = body.theme_mode;
  }

  if (body.theme_color !== undefined) {
    if (!Object.keys(COLOR_PRESETS).includes(body.theme_color)) {
      return badRequest('ערכת צבע לא תקינה');
    }
    patch.theme_color = body.theme_color;
  }

  if (Object.keys(patch).length === 0) return badRequest('אין שדות לעדכון');

  const { error } = await supabase.from('users').update(patch).eq('id', auth.userId);

  if (error) {
    console.error('[api/users/me/preferences] update failed:', error.message);
    return serverError('שמירת ההעדפות נכשלה');
  }

  return NextResponse.json({ success: true });
}
