import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthInfo, requireApproved, serverError } from '@/lib/api/auth';
import { sanitizeSearchQuery } from '@/lib/utils';
import { isUserRole } from '@/types/roles';
import type { UserRow } from '@/types/database.types';

/**
 * Directory listing.
 *
 * Readable by any approved ADMIN/SYSTEM_MANAGER (the RLS policy narrows to
 * self-or-admin — see 20260103000000_add_staff_role.sql); management routes
 * are admin-gated too. A STAFF-role caller (e.g. Shift7) hitting this route
 * gets back only their own row, not the full directory.
 */

export interface UsersResponse {
  users: UserRow[];
  total: number;
}

const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await getAuthInfo(supabase);

  const denied = requireApproved(auth);
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const search = params.get('search')?.trim();
  const role = params.get('role');
  const isActive = params.get('isActive');
  const page = Math.max(0, Number(params.get('page') ?? 0));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get('pageSize') ?? 20)));

  let query = supabase.from('users').select('*', { count: 'exact' });

  if (search) {
    const term = sanitizeSearchQuery(search);
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  if (role === 'pending') {
    query = query.is('app_role', null);
  } else if (isUserRole(role)) {
    // Anything else in ?role= is ignored rather than passed to the query —
    // an unknown filter must not silently widen the result set.
    query = query.eq('app_role', role);
  }
  if (isActive === 'true' || isActive === 'false') {
    query = query.eq('is_active', isActive === 'true');
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (error) {
    console.error('[api/users] list failed:', error.message);
    return serverError('טעינת המשתמשים נכשלה');
  }

  const response: UsersResponse = { users: data ?? [], total: count ?? 0 };
  return NextResponse.json(response);
}
