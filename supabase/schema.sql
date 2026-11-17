-- Run once in the Supabase SQL editor.
-- Only drivers who sign up are stored. The full TLC list is never copied.
-- RLS is on with NO policies: browsers (anon/authenticated keys) cannot read
-- or write these tables. Only the server (service-role key) can.

create table if not exists public.driver_links (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  license_number     bigint not null,
  driver_name        text   not null,           -- as listed by TLC when claimed
  license_type       text,
  expiration_date    date,
  wheelchair_trained text,
  status             text   not null default 'active'
                     check (status in ('active', 'removed')),
  missed_checks      int    not null default 0, -- consecutive healthy checks where license was absent
  telegram_chat_id   bigint,
  telegram_token     text unique,               -- one-time token for the t.me deep link
  expiry_alerted_for date,                      -- expiration date we already warned about
  last_checked_at    timestamptz,
  created_at         timestamptz not null default now()
);
alter table public.driver_links enable row level security;

create index if not exists driver_links_chat_idx on public.driver_links (telegram_chat_id);

-- Failed claim attempts, used to rate-limit guessing of license/name pairs.
create table if not exists public.claim_attempts (
  id      bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ok      boolean not null,
  at      timestamptz not null default now()
);
alter table public.claim_attempts enable row level security;
create index if not exists claim_attempts_user_at_idx on public.claim_attempts (user_id, at desc);

-- Last healthy size/date of the TLC feed, used to skip "everyone vanished" glitches.
create table if not exists public.feed_state (
  id          int primary key default 1 check (id = 1),
  row_count   int,
  max_updated date,
  checked_at  timestamptz
);
alter table public.feed_state enable row level security;
