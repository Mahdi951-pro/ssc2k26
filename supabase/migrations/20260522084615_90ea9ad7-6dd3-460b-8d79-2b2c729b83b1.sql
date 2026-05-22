
-- Web Push subscriptions for mobile notifications
create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users manage own push subs - select"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users manage own push subs - insert"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users manage own push subs - update"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

create policy "Users manage own push subs - delete"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create trigger update_push_subs_updated_at
  before update on public.push_subscriptions
  for each row execute function public.update_updated_at_column();

-- Trigger: when a new message is inserted, invoke the send-push edge function
create or replace function public.notify_push_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _url text := 'https://ydxuzopqmwtsogfhknsf.supabase.co/functions/v1/send-push';
  _key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkeHV6b3BxbXd0c29nZmhrbnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTUzODEsImV4cCI6MjA5MjU5MTM4MX0.xStFnfbIwLwYUpNDAOjt8CHG6ltgJ3BcuLsiiXwAjZQ';
begin
  perform net.http_post(
    url := _url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||_key),
    body := jsonb_build_object('message_id', NEW.id::text)
  );
  return NEW;
exception when others then
  return NEW;
end;
$$;

drop trigger if exists trg_notify_push_on_message on public.messages;
create trigger trg_notify_push_on_message
  after insert on public.messages
  for each row execute function public.notify_push_on_message();
