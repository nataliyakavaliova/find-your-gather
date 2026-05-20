
-- enums
create type public.photo_status as enum ('pending','approved','rejected');
create type public.report_target as enum ('event','photo');
create type public.report_status as enum ('open','hidden','dismissed');

-- hidden columns
alter table public.events add column hidden boolean not null default false;

-- gallery_photos
create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  uploader_id uuid not null,
  photo_url text not null,
  caption text,
  status public.photo_status not null default 'pending',
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index on public.gallery_photos(event_id);
create index on public.gallery_photos(status);

alter table public.gallery_photos enable row level security;

create policy "Approved photos visible to all"
  on public.gallery_photos for select to public
  using (status='approved' and hidden=false);

create policy "Uploader sees own photos"
  on public.gallery_photos for select to authenticated
  using (uploader_id = auth.uid());

create policy "Host members see all photos"
  on public.gallery_photos for select to authenticated
  using (exists (select 1 from public.events e where e.id = gallery_photos.event_id and public.is_host_member(e.host_id, auth.uid())));

create policy "Going attendees can upload"
  on public.gallery_photos for insert to authenticated
  with check (
    uploader_id = auth.uid()
    and exists (select 1 from public.rsvps r where r.event_id = gallery_photos.event_id and r.user_id = auth.uid() and r.status='going')
  );

create policy "Host members moderate photos"
  on public.gallery_photos for update to authenticated
  using (exists (select 1 from public.events e where e.id = gallery_photos.event_id and public.is_host_member(e.host_id, auth.uid())));

create policy "Host members delete photos"
  on public.gallery_photos for delete to authenticated
  using (exists (select 1 from public.events e where e.id = gallery_photos.event_id and public.is_host_member(e.host_id, auth.uid())));

-- feedback
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index on public.feedback(event_id);

alter table public.feedback enable row level security;

create policy "Feedback for ended events visible to all"
  on public.feedback for select to public
  using (exists (select 1 from public.events e where e.id = feedback.event_id and e.ends_at < now()));

create policy "Going attendees can leave feedback after end"
  on public.feedback for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.rsvps r join public.events e on e.id = r.event_id
      where r.event_id = feedback.event_id and r.user_id = auth.uid()
        and r.status='going' and e.ends_at < now()
    )
  );

create policy "Users update own feedback"
  on public.feedback for update to authenticated
  using (user_id = auth.uid());

create policy "Users delete own feedback"
  on public.feedback for delete to authenticated
  using (user_id = auth.uid());

-- reports
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type public.report_target not null,
  target_id uuid not null,
  reporter_id uuid not null,
  reason text not null,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index on public.reports(status);

alter table public.reports enable row level security;

-- helper to resolve host of a report target
create or replace function public.report_host_id(_target_type public.report_target, _target_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when _target_type = 'event' then (select host_id from public.events where id = _target_id)
    when _target_type = 'photo' then (
      select e.host_id from public.gallery_photos p
      join public.events e on e.id = p.event_id
      where p.id = _target_id
    )
  end
$$;

create policy "Reporter sees own reports"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid());

create policy "Host members see reports for their host"
  on public.reports for select to authenticated
  using (public.is_host_member(public.report_host_id(target_type, target_id), auth.uid()));

create policy "Authenticated users can report"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "Hosts can update reports"
  on public.reports for update to authenticated
  using (public.has_host_role(public.report_host_id(target_type, target_id), auth.uid(), 'host'));

-- storage bucket
insert into storage.buckets (id, name, public)
values ('gallery-photos','gallery-photos', true)
on conflict (id) do nothing;

create policy "Gallery photos public read"
  on storage.objects for select to public
  using (bucket_id = 'gallery-photos');

create policy "Authenticated can upload gallery photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery-photos');
