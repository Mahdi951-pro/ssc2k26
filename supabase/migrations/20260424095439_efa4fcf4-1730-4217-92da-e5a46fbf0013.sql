-- ============ STORAGE BUCKETS ============
insert into storage.buckets (id, name, public)
values 
  ('avatars', 'avatars', true),
  ('chat-media', 'chat-media', false),
  ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

-- Avatars: public read, owner write
create policy "Avatars publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Chat media: members of the conversation can read (path: <conversation_id>/<file>)
create policy "Members read chat media"
  on storage.objects for select
  using (
    bucket_id = 'chat-media'
    and public.is_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

create policy "Members upload chat media"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-media'
    and public.is_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

create policy "Uploaders delete chat media"
  on storage.objects for delete
  using (
    bucket_id = 'chat-media'
    and owner = auth.uid()
  );

-- Voice notes: same model
create policy "Members read voice notes"
  on storage.objects for select
  using (
    bucket_id = 'voice-notes'
    and public.is_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

create policy "Members upload voice notes"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-notes'
    and public.is_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

create policy "Uploaders delete voice notes"
  on storage.objects for delete
  using (
    bucket_id = 'voice-notes'
    and owner = auth.uid()
  );

-- ============ POLLS ============
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  created_by uuid not null,
  question text not null check (char_length(question) between 1 and 200),
  options jsonb not null, -- array of strings
  multi_choice boolean not null default false,
  is_anonymous boolean not null default false,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_polls_conv on public.polls(conversation_id);

alter table public.polls enable row level security;

create policy "Polls visible to members"
  on public.polls for select
  using (public.is_member(conversation_id, auth.uid()));

create policy "Members create polls"
  on public.polls for insert
  with check (auth.uid() = created_by and public.is_member(conversation_id, auth.uid()));

create policy "Creator or admin updates poll"
  on public.polls for update
  using (auth.uid() = created_by or public.has_role(auth.uid(), 'admin'));

create policy "Creator or admin deletes poll"
  on public.polls for delete
  using (auth.uid() = created_by or public.has_role(auth.uid(), 'admin'));

-- Poll votes
create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null,
  option_index int not null,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id, option_index)
);

create index idx_votes_poll on public.poll_votes(poll_id);

alter table public.poll_votes enable row level security;

create policy "Votes visible to poll members"
  on public.poll_votes for select
  using (
    exists (
      select 1 from public.polls p
      where p.id = poll_votes.poll_id
      and public.is_member(p.conversation_id, auth.uid())
    )
  );

create policy "Users cast own vote"
  on public.poll_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.polls p
      where p.id = poll_votes.poll_id
      and public.is_member(p.conversation_id, auth.uid())
    )
  );

create policy "Users remove own vote"
  on public.poll_votes for delete
  using (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_votes;