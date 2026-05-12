-- 8. email_permutations
create table if not exists email_permutations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  email text not null,
  status text check (status in ('pending', 'valid', 'invalid', 'catch_all', 'unknown', 'skipped')) default 'pending',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique(contact_id, email)
);

-- RLS
alter table email_permutations enable row level security;
drop policy if exists "Users see own permutations" on email_permutations;
create policy "Users see own permutations" on email_permutations for all using (
  exists (select 1 from contacts where contacts.id = email_permutations.contact_id and contacts.user_id = auth.uid())
);
