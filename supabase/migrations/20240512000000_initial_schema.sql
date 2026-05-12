-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- 1. user_context
create table user_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,

  -- Identity
  name text not null,                        -- "Anubhav Jaiswal"
  "current_role" text,                         -- "Backend Engineer, Founding Team"
  years_exp text,                            -- "2+"
  location text,                             -- "Bhubaneswar / Remote"

  -- The hook
  headline text,                             -- "Built Synq — zero-disk Go pipeline, 588k rows/sec"
  loom_url text,                             -- demo video link
  portfolio_url text,
  github_url text,
  linkedin_url text,

  -- Projects (JSON array of {name, description, tech, metric})
  projects jsonb default '[]',

  -- Stack & expertise
  primary_stack text,                        -- "Go, Java, Spring Boot, PostgreSQL"
  specialisation text,                       -- "Distributed systems, microservices, high-throughput pipelines"

  -- What you want
  target_role text,                          -- "Founding/Backend Engineer"
  target_stage text,                         -- "Seed, Series A"
  open_to text,                              -- "Remote, Bangalore"

  -- Tone preferences
  email_tone text,                           -- "Direct, technical, under 120 words"
  li_tone text,                              -- "Peer-to-peer, specific, not salesy"

  -- Extra context for AI
  extra_context text,                        -- free-form notes fed into every prompt

  updated_at timestamptz default now()
);

-- 2. companies
create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,

  name text not null,
  tier int check (tier in (1, 2, 3)) default 2,
  
  funding_stage text,                        -- "Seed", "Series A", "Series B", "Pre-seed"
  funding_date date,
  employee_count int,
  tech_stack text[],                         -- ["Go", "Rust", "PostgreSQL"]
  source text,                               -- "Wellfound", "YC", "LinkedIn", "Twitter", "Tracxn"
  job_posting_url text,
  website_url text,
  notes text,

  created_at timestamptz default now()
);

-- 3. contacts
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  company_id uuid references companies(id) on delete cascade,

  -- Identity
  name text not null,
  title text,
  contact_type text check (contact_type in ('cto_founder', 'lead_eng', 'other')) default 'cto_founder',
  linkedin_url text,
  email text,
  notes text,
  outcome text check (outcome in ('active', 'rejected', 'ghosted', 'no_role', 'hired', 'referral')) default 'active',
  reply_channel text check (reply_channel in ('linkedin', 'email')),

  -- LinkedIn sequence (all Date — null = not done)
  li_visited_at date,           -- Step 1: visit profile
  li_commented_at date,         -- Step 2: leave specific technical comment (same day)
  li_connection_sent_at date,   -- Step 3: send connection request (day after comment)
  li_connected_at date,         -- They accepted the request
  li_message_sent_at date,      -- Message sent post-accept (before email goes out)

  -- Email sequence (null = not sent)
  email1_sent_at date,
  email2_sent_at date,
  email3_sent_at date,

  -- Hot signals
  loom_viewed_at date,          -- They watched your Loom demo (hottest signal)
  replied_at date,              -- They replied to anything
  call_booked_at date,          -- Call scheduled

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. linkedin_profiles
create table linkedin_profiles (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade unique,

  -- Scraped fields
  headline text,                             -- "CTO at Hasura | GraphQL | Distributed Systems"
  about text,                                -- their bio/summary
  current_company_description text,         -- company description from their profile
  experience jsonb default '[]',            -- [{title, company, duration, description}]
  skills jsonb default '[]',               -- ["Go", "Distributed Systems", ...]
  recent_posts jsonb default '[]',         -- [{text, date, likes, comments, url}]
  articles jsonb default '[]',             -- [{title, url, date}]

  -- Meta
  scraped_at timestamptz default now(),
  apify_run_id text,
  raw_data jsonb                            -- full Apify response, for debugging
);

-- 5. generated_messages
create table generated_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade unique,

  -- LinkedIn messages
  li_comment text,                          -- comment to leave on their post
  li_connection_note text,                  -- note with connection request (1 sentence max)
  li_message text,                          -- message after they accept

  -- Email sequence
  email1_subject text,
  email1_body text,
  email2_subject text,
  email2_body text,
  email3_subject text,
  email3_body text,

  -- Meta
  generated_at timestamptz default now(),
  model_used text default 'minimax/minimax-text-01',
  prompt_version int default 1,            -- increment when prompts change to track quality
  manually_regenerated boolean default false
);

-- 6. actions_log
create table actions_log (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  user_id uuid references auth.users not null,

  action_type text not null,
  -- "li_visit", "li_comment", "li_connection_sent", "li_connected",
  -- "li_message", "email1", "email2", "email3",
  -- "loom_viewed", "replied", "call_booked", "call_done", "note"

  notes text,
  outcome text check (outcome in ('positive', 'neutral', 'negative', 'pending')) default 'pending',
  created_at timestamptz default now()
);

-- 7. Row Level Security
alter table user_context enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table linkedin_profiles enable row level security;
alter table generated_messages enable row level security;
alter table actions_log enable row level security;

-- Policies
create policy "Users see own context" on user_context for all using (user_id = auth.uid());
create policy "Users see own companies" on companies for all using (user_id = auth.uid());
create policy "Users see own contacts" on contacts for all using (user_id = auth.uid());
create policy "Users see own linkedin_profiles" on linkedin_profiles for all using (
  exists (select 1 from contacts where contacts.id = linkedin_profiles.contact_id and contacts.user_id = auth.uid())
);
create policy "Users see own generated_messages" on generated_messages for all using (
  exists (select 1 from contacts where contacts.id = generated_messages.contact_id and contacts.user_id = auth.uid())
);
create policy "Users see own actions_log" on actions_log for all using (user_id = auth.uid());

-- Triggers for updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_user_context_updated_at before update on user_context for each row execute procedure update_updated_at_column();
create trigger update_contacts_updated_at before update on contacts for each row execute procedure update_updated_at_column();
