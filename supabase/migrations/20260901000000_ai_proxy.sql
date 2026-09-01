-- Accounts and server-side AI metering for the hosted proxy.
--
-- The desktop app ships no provider key. It authenticates as a Supabase user and
-- calls the ai-chat Edge Function, which holds the OpenAI key and meters usage
-- here. Everything in this file exists so that a client which lies about who it
-- is, or edits its own local database, still cannot spend more than its quota.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on signup.

create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Signup runs as the auth admin, not as the new user, so the row is created by
-- a trigger rather than by a client insert (there is no insert policy at all).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- ai_usage: per-user request counters.
--
-- Note the policy list: SELECT only. There is deliberately no insert, update, or
-- delete policy, so no client — even holding a valid JWT — can write its own
-- counters. Increments happen exclusively through consume_ai_quota() below.

create table public.ai_usage (
  user_id       uuid primary key references auth.users on delete cascade,
  day           date not null default current_date,
  daily_count   int  not null default 0,
  month         text not null default to_char(now(), 'YYYY-MM'),
  monthly_count int  not null default 0,
  updated_at    timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

create policy "read own usage"
  on public.ai_usage for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ai_limits: the quota, in one place.
--
-- Readable by any signed-in user so Settings can show "3 / 20 today" without a
-- round trip to the function, and read by consume_ai_quota() so the number the
-- UI displays and the number that is enforced cannot drift apart. Changing the
-- allowance is an UPDATE, not a redeploy.

create table public.ai_limits (
  id            int primary key default 1 check (id = 1),
  daily_limit   int not null default 20,
  monthly_limit int not null default 200
);

alter table public.ai_limits enable row level security;

create policy "read limits"
  on public.ai_limits for select
  to authenticated
  using (true);

insert into public.ai_limits (id) values (1);

-- ---------------------------------------------------------------------------
-- global_usage: circuit breaker.
--
-- OAuth raises the cost of farming accounts but does not prevent it. This is the
-- backstop that keeps a bad month from draining the card: one row, no RLS policy
-- of any kind, readable and writable only by consume_ai_quota().

create table public.global_usage (
  id            int primary key default 1 check (id = 1),
  month         text not null default to_char(now(), 'YYYY-MM'),
  monthly_count int  not null default 0,
  monthly_limit int  not null default 20000,
  updated_at    timestamptz not null default now()
);

alter table public.global_usage enable row level security;

insert into public.global_usage (id) values (1);

-- ---------------------------------------------------------------------------
-- consume_ai_quota: the only path that increments usage.
--
-- SECURITY DEFINER so it can write past the RLS policies above; keyed on
-- auth.uid() so it can only ever touch the caller's own row. Rollover is lazy —
-- a stored day/month that no longer matches "now" is treated as zero — which
-- mirrors the local implementation this replaces and needs no scheduled job.
--
-- Rejected requests write nothing at all: being over a limit must never itself
-- consume a slot.
--
-- Day and month boundaries are UTC (the database's clock). The local version
-- rolled over at the user's own midnight, but a client-supplied timezone is
-- exactly the kind of input a client can lie about to earn a second daily quota.

create type public.quota_result as (
  allowed       boolean,
  reason        text,
  daily_used    int,
  daily_limit   int,
  monthly_used  int,
  monthly_limit int
);

create function public.consume_ai_quota()
returns public.quota_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_today     date := current_date;
  v_month     text := to_char(now(), 'YYYY-MM');
  p_daily_limit   int;
  p_monthly_limit int;
  v_daily     int;
  v_monthly   int;
  v_global    int;
  v_global_max int;
begin
  select daily_limit, monthly_limit
  into p_daily_limit, p_monthly_limit
  from public.ai_limits where id = 1;

  if v_user is null then
    return (false, 'not_authenticated', 0, p_daily_limit, 0, p_monthly_limit)::public.quota_result;
  end if;

  insert into public.ai_usage (user_id) values (v_user)
  on conflict (user_id) do nothing;

  -- Lock this user's row for the check-and-increment so two concurrent requests
  -- cannot both read the same count and both be allowed through.
  select
    case when day   = v_today then daily_count   else 0 end,
    case when month = v_month then monthly_count else 0 end
  into v_daily, v_monthly
  from public.ai_usage
  where user_id = v_user
  for update;

  if v_daily >= p_daily_limit then
    return (false, 'daily_limit', v_daily, p_daily_limit, v_monthly, p_monthly_limit)::public.quota_result;
  end if;

  if v_monthly >= p_monthly_limit then
    return (false, 'monthly_limit', v_daily, p_daily_limit, v_monthly, p_monthly_limit)::public.quota_result;
  end if;

  select
    case when month = v_month then monthly_count else 0 end,
    monthly_limit
  into v_global, v_global_max
  from public.global_usage
  where id = 1
  for update;

  if v_global >= v_global_max then
    return (false, 'global_limit', v_daily, p_daily_limit, v_monthly, p_monthly_limit)::public.quota_result;
  end if;

  update public.ai_usage
  set day           = v_today,
      daily_count   = v_daily + 1,
      month         = v_month,
      monthly_count = v_monthly + 1,
      updated_at    = now()
  where user_id = v_user;

  update public.global_usage
  set month         = v_month,
      monthly_count = v_global + 1,
      updated_at    = now()
  where id = 1;

  return (true, null, v_daily + 1, p_daily_limit, v_monthly + 1, p_monthly_limit)::public.quota_result;
end;
$$;

-- Callable by signed-in users only. The function reads auth.uid() itself, so
-- there is no argument through which one user could name another.
revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;
