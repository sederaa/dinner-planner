begin;

alter table if exists public.dishes enable row level security;
alter table if exists public.meal_plans enable row level security;
alter table if exists public.rules_config enable row level security;
alter table if exists public.user_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dishes'
      and policyname = 'dishes_full_access_anon_authenticated'
  ) then
    create policy dishes_full_access_anon_authenticated
      on public.dishes
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'meal_plans'
      and policyname = 'meal_plans_full_access_anon_authenticated'
  ) then
    create policy meal_plans_full_access_anon_authenticated
      on public.meal_plans
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rules_config'
      and policyname = 'rules_config_full_access_anon_authenticated'
  ) then
    create policy rules_config_full_access_anon_authenticated
      on public.rules_config
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_settings'
      and policyname = 'user_settings_full_access_anon_authenticated'
  ) then
    create policy user_settings_full_access_anon_authenticated
      on public.user_settings
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end
$$;

commit;
