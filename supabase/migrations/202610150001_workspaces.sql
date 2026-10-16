-- Run once in your Supabase project's SQL Editor.
-- Each account owns one versioned expense workspace; never use a service key in React.
begin;

create table public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and data ?& array['version', 'transactions', 'categories', 'budgets', 'heatThresholds', 'budgetThresholds']
    and data @> '{"version":1}'::jsonb
    and jsonb_typeof(data -> 'transactions') = 'array'
    and jsonb_typeof(data -> 'categories') = 'array'
    and jsonb_typeof(data -> 'budgets') = 'object'
    and jsonb_typeof(data -> 'heatThresholds') = 'array'
    and jsonb_typeof(data -> 'budgetThresholds') = 'array'
    and octet_length(data::text) <= 10485760
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon, authenticated;
grant select on public.workspaces to authenticated;
create policy "Read own expense workspace" on public.workspaces
  for select to authenticated using ((select auth.uid()) = user_id);

-- All writes go through this function for atomic revision checks.
-- Owner identity comes from the signed-in JWT, never a client-supplied user ID.
create function public.save_workspace(payload jsonb, expected_revision bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  next_revision bigint;
begin
  if owner_id is null then
    raise exception 'Sign in before saving.' using errcode = '42501';
  end if;
  if expected_revision is null or expected_revision < 0 or expected_revision >= 9007199254740991 then
    raise exception 'Invalid revision.' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    insert into public.workspaces(user_id, data, revision)
      values (owner_id, payload, 1)
      on conflict (user_id) do nothing returning revision into next_revision;
  else
    update public.workspaces set data = payload, revision = revision + 1, updated_at = now()
      where user_id = owner_id and revision = expected_revision
      returning revision into next_revision;
  end if;
  if next_revision is null then
    raise exception 'Workspace changed. Reload before saving.' using errcode = '40001';
  end if;
  return next_revision;
end;
$$;
revoke all on function public.save_workspace(jsonb, bigint) from public, anon;
grant execute on function public.save_workspace(jsonb, bigint) to authenticated;
commit;
