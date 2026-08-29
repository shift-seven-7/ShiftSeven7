-- The initial custom_access_token_hook was missing `security definer`, so it
-- ran with supabase_auth_admin's own privileges when Supabase Auth called
-- it - which don't include SELECT on public.staff - and every login failed
-- with "Error running hook URI: ...". security definer runs the function as
-- its owner instead; `set search_path` pins it against search-path hijacking
-- (standard practice for security definer functions).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  role_for_user public.app_role;
begin
  select access_level into role_for_user
  from public.staff
  where user_id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(
    claims,
    '{user_role}',
    to_jsonb(coalesce(role_for_user, 'no_access'::public.app_role))
  );

  return jsonb_set(event, '{claims}', claims);
end;
$$;
