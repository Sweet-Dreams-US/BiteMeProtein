-- 20260422000000_pickup_hours_ranges.sql
-- Expand pickup_schedule to support multiple time ranges per day, so Haley
-- can configure split shifts (e.g., "Wed: 10am-12pm, then 3pm-6pm") or
-- half-days (e.g., "Sat: 10am-2pm only"). The original single open_time /
-- close_time is kept as the first range when present, to avoid breaking
-- any in-flight code still reading those columns.

-- Supporting table: one row per open range per day of week.
create table if not exists public.pickup_schedule_ranges (
  id           uuid primary key default gen_random_uuid(),
  day_of_week  smallint not null references public.pickup_schedule(day_of_week) on delete cascade,
  open_time    time     not null,
  close_time   time     not null,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  check (open_time < close_time)
);

create index if not exists pickup_schedule_ranges_dow_idx
  on public.pickup_schedule_ranges (day_of_week, sort_order);

-- Seed ranges from existing single-range rows so current behavior is
-- preserved: for every open day that has both open_time and close_time,
-- create a single matching range entry.
insert into public.pickup_schedule_ranges (day_of_week, open_time, close_time, sort_order)
select day_of_week, open_time, close_time, 0
from public.pickup_schedule
where is_open = true
  and open_time is not null
  and close_time is not null
  and not exists (
    select 1 from public.pickup_schedule_ranges r where r.day_of_week = pickup_schedule.day_of_week
  );

-- RLS — public read (checkout needs to render slots), admin write.
alter table public.pickup_schedule_ranges enable row level security;

drop policy if exists "public read pickup_schedule_ranges" on public.pickup_schedule_ranges;
create policy "public read pickup_schedule_ranges"
  on public.pickup_schedule_ranges for select to anon, authenticated
  using (true);

drop policy if exists "admin write pickup_schedule_ranges" on public.pickup_schedule_ranges;
create policy "admin write pickup_schedule_ranges"
  on public.pickup_schedule_ranges for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
