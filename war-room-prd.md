# War Room — Product Requirements Document
### Job Search Outreach Intelligence System
**Version:** 1.0  
**Author:** Anubhav Jaiswal  
**Date:** May 2026  
**Status:** Ready for Development

---

## 1. Overview

War Room is a personal job search outreach management system built for a structured, high-volume 14-day outreach sprint targeting founding/backend engineer roles at early-stage startups. It replaces manual spreadsheet tracking with an intelligent, AI-assisted pipeline that auto-prioritises leads, generates personalised outreach messages using scraped LinkedIn context, and tells the user exactly what to do each day — in order of urgency.

### 1.1 Problem

Running a structured outreach campaign across 80–120 leads requires tracking 11+ actions per contact (LinkedIn visits, comments, connection requests, 3-stage emails, Loom views, replies, calls). Doing this manually in a spreadsheet means:

- Forgetting who to follow up with and when
- Writing generic messages that don't get replies
- Spending time on research instead of outreach
- No visibility into pipeline health or daily priorities

### 1.2 Solution

A NextJS web app backed by Supabase that:

1. Stores companies and contacts with all action timestamps
2. Auto-computes each contact's next action and priority score every time the page loads
3. Scrapes LinkedIn profiles via Apify when a contact is added
4. Generates all 6 outreach messages (LI comment, connection note, LI message, Email 1/2/3) using OpenRouter (MiniMax 2.5) with the user's full context + the contact's actual LinkedIn data
5. Presents a prioritised "Today's Actions" dashboard so the user opens the app and immediately knows what to do

---

## 2. Users

Single user. The app is personal, not multi-tenant. Supabase Auth provides login. All data is scoped to one user ID via Row Level Security.

---

## 3. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | NextJS 14 (App Router) | Familiar, fast, Vercel deploy |
| Database + Auth | Supabase (Postgres + RLS) | Relational, free tier, real-time capable |
| Styling | Tailwind CSS | Fast to build, consistent |
| AI Generation | OpenRouter → MiniMax 2.5 | Free tier, good instruction following |
| LinkedIn Scraping | Apify (linkedin-profile-scraper) | ~$0.01/profile, ~500 free credits on signup |
| Deploy | Vercel (free tier) | Auto-deploy on push |

---

## 4. Database Schema

### 4.1 `user_context`
Stores everything about the user that feeds into AI prompts. Filled once, used on every generation call.

```sql
create table user_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,

  -- Identity
  name text not null,                        -- "Anubhav Jaiswal"
  current_role text,                         -- "Backend Engineer, Founding Team"
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
```

### 4.2 `companies`
One row per company.

```sql
create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,

  name text not null,
  tier int check (tier in (1, 2, 3)) default 2,
  -- Tier 1: funded <90d, <50 ppl, Go/Rust/Python stack, actively hiring
  -- Tier 2: Series A, 50-150 employees, founding roles still open
  -- Tier 3: everything else

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
```

### 4.3 `contacts`
One row per person. All action timestamps live here. Empty = not done. Filled = done on that date.

```sql
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  company_id uuid references companies(id) on delete cascade,

  -- Identity
  name text not null,
  title text,
  contact_type text check (contact_type in ('cto_founder', 'lead_eng', 'other')) default 'cto_founder',
  -- cto_founder: primary target, email sequence starts with them
  -- lead_eng: Email 3 pivot target if CTO doesn't respond
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
  -- Email 1: send after li_connection_sent_at + 48h OR immediately if no LinkedIn
  -- Email 2: send 5 days after Email 1
  -- Email 3: send 5 days after Email 2 (pivot to different person)
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
```

### 4.4 `linkedin_profiles`
Scraped LinkedIn data from Apify. Used to personalise AI-generated messages.

```sql
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
```

### 4.5 `generated_messages`
AI-generated outreach messages per contact. Stored so they don't regenerate on every open.

```sql
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
```

### 4.6 `actions_log`
Activity log. Every action taken gets a row. Used for weekly diagnostics.

```sql
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
```

### 4.7 Row Level Security
Enable RLS on all tables. Every table has a policy: `user_id = auth.uid()`. Users can only see and modify their own data.

```sql
-- Example (repeat for all tables)
alter table companies enable row level security;
create policy "Users see own companies"
  on companies for all
  using (user_id = auth.uid());
```

---

## 5. Priority Score & Next Action Logic

This is the core intelligence of the system. Lives in `lib/priority.ts`. Runs client-side on every render. No database calls needed.

### 5.1 Next Action (string label per contact)

Computed by checking fields in strict priority order:

```
1. replied_at is set                              → "💬 Respond to their reply"
2. loom_viewed_at is set + replied_at is null     → "🔥 Follow up — they watched your Loom"
3. call_booked_at is set                          → "📞 Confirm call details"
4. email3_sent_at is set                          → "" (sequence complete, hide from Today)
5. email2_sent_at is set + days since >= 5        → "📧 Send pivot email (Email 3)"
6. email2_sent_at is set + days since < 5         → "" (waiting, hide from Today)
7. email1_sent_at is set + days since >= 5        → "📧 Send follow-up (Email 2)"
8. email1_sent_at is set + days since < 5         → "" (waiting, hide from Today)
9. li_connected_at is set                         → "📧 Send first email"
10. li_connection_sent_at is set + days >= 2      → "📧 Send first email (48h passed)"
11. li_connection_sent_at is set + days < 2       → "" (waiting for accept, hide)
12. li_commented_at is set                        → "🤝 Send connection request"
13. li_visited_at is set                          → "💬 Leave a comment"
14. linkedin_url is set                           → "👁 Visit LinkedIn profile"
15. email is set (no LinkedIn)                    → "📧 Send first email (no LinkedIn)"
16. neither set                                   → "⚠️ Add LinkedIn or email"
```

Contacts where Next Action is empty string are hidden from the Today's Actions view. They are waiting and need no action right now.

### 5.2 Priority Score (number, used for sort order)

```
outcome is rejected/ghosted/no_role/hired   →   0  (dead, sink to bottom)
replied_at is set                           → 100  (respond NOW)
loom_viewed_at + no reply                   →  90  (hottest cold signal)
call_booked_at                              →  85
next action contains "email" + tier 1       →  70
next action contains "email" + tier 2       →  60
next action contains "email" + tier 3       →  50
next action contains "connection" + tier 1  →  40
next action contains "visit/comment" + T1   →  35
next action contains "connection" + tier 2  →  30
next action contains "visit/comment" + T2   →  25
next action contains "connection" + tier 3  →  20
next action contains "visit/comment" + T3   →  15
sequence complete                           →   5
```

### 5.3 Days Since Last Touch (computed field)

```typescript
const lastTouched = Math.max(
  ...[
    li_visited_at, li_commented_at, li_connection_sent_at,
    li_connected_at, li_message_sent_at,
    email1_sent_at, email2_sent_at, email3_sent_at
  ]
  .filter(Boolean)
  .map(d => new Date(d).getTime())
)
const daysSince = lastTouched 
  ? Math.floor((Date.now() - lastTouched) / 86400000) 
  : 999
```

---

## 6. AI Message Generation

### 6.1 Trigger

Messages are generated automatically when:
- A contact is saved with a LinkedIn URL → Apify scrape completes → webhook fires → generation runs
- A contact is saved with only an email (no LinkedIn) → generation runs immediately
- User clicks "↺ Regenerate" on a contact card

### 6.2 OpenRouter Call

```
Model: minimax/minimax-text-01 (free on OpenRouter)
Response format: JSON object
Temperature: 0.7
Max tokens: 2000
```

Single call returns all 6 messages as a structured JSON object.

### 6.3 System Prompt Structure

```
You are a technical outreach specialist writing messages for a backend software engineer 
doing a structured job search sprint.

ABOUT THE SENDER:
{user_context fields: name, headline, loom_url, primary_stack, specialisation, 
 target_role, projects, email_tone, li_tone, extra_context}

STRICT RULES:
- LinkedIn comment: 1-2 sentences, technically grounded, reference something specific 
  from their actual recent post. Sound like a peer, not a fan. No flattery.
- Connection note: 1 sentence max. Mention something specific about their work.
- LinkedIn message (post-accept): 2-3 sentences. Make the email feel expected.
- Email 1 body: Under 120 words. One link (Loom). One ask (15 min call). 
  First sentence must reference something specific to THIS company.
- Email 2 body: Value-add. Reference something new (post, commit, job posting update). 
  Under 100 words. Reply to Email 1 thread.
- Email 3 body: Pivot to a different person. Under 80 words. Mention previous contact name.
- All subjects: Specific, no generic phrases, reference a technical detail or metric.

OUTPUT FORMAT: Return valid JSON with keys:
li_comment, li_connection_note, li_message,
email1_subject, email1_body,
email2_subject, email2_body,
email3_subject, email3_body
```

### 6.4 User Prompt Structure

```
ABOUT THE RECIPIENT:
Name: {contact.name}
Title: {contact.title}
Company: {company.name}
Company stage: {company.funding_stage}, {company.employee_count} employees
Company tech stack: {company.tech_stack}
Job posting notes: {company.notes}

THEIR LINKEDIN DATA (use this to personalise):
Headline: {linkedin_profile.headline}
About: {linkedin_profile.about}
Most recent post: {linkedin_profile.recent_posts[0].text} ({likes} likes, {days} days ago)
Second recent post: {linkedin_profile.recent_posts[1].text}
Skills: {linkedin_profile.skills}
Past companies: {linkedin_profile.experience[].company}

Generate all 9 outreach messages now.
```

---

## 7. Apify Integration

### 7.1 Flow

1. Contact saved with `linkedin_url` set
2. NextJS API route `POST /api/apify/trigger` calls Apify REST API to start a run of `apify/linkedin-profile-scraper` with the LinkedIn URL
3. Apify runs the scrape (~20-30 seconds)
4. Apify sends a webhook to `POST /api/webhooks/apify` when complete
5. Webhook handler saves scraped data to `linkedin_profiles` table
6. Webhook handler calls `POST /api/generate` to generate messages
7. Contact card UI polls or uses Supabase Realtime to detect when `generated_messages` row is created and shows "✨ Messages Ready"

### 7.2 Apify Actor

```
Actor ID: apify/linkedin-profile-scraper
Input: { "profileUrls": ["https://linkedin.com/in/username"] }
Webhook: POST https://your-app.vercel.app/api/webhooks/apify
```

### 7.3 Status on Contact Card

```
[Scraping LinkedIn...]     ← Apify run in progress
[Generating messages...]   ← OpenRouter call in progress
[✨ Messages Ready]        ← generated_messages row exists
[↺ Regenerate]             ← shown alongside ready state
```

---

## 8. Pages & Features

### 8.1 `/login`
Supabase Auth email/password login. Redirect to `/dashboard` on success.

### 8.2 `/dashboard` — War Room (Default Page)

The home screen. Opens to this page every time.

**Top section — Stats bar:**
```
[ Total Active: 94 ]  [ Replied: 6 ]  [ Loom Viewed: 3 ]  [ Calls: 2 ]
```
Computed from DB counts. Updates on each page load.

**Main section — Today's Actions:**
Table/list of contacts where `nextAction` is not empty and `outcome` is `active`.
Sorted by `priorityScore` descending.

Columns: Name, Company, Tier badge, Next Action, Days Since Touch, action buttons

**Action buttons per row (inline):**
Quick-tap buttons that set the relevant date field to today via a Supabase update.
- Show only the button for the contact's current next action
- Example: if next action is "👁 Visit LinkedIn profile", show only `[ 👁 Done ]`
- After tap: field updates, next action recalculates, row re-sorts instantly

**Bottom section — Hot Leads:**
Contacts where `loom_viewed_at` is set OR `replied_at` is set.
Always visible regardless of sequence stage.

### 8.3 `/dashboard/pipeline`
Full contact list. Grouped by Sequence Stage. Filterable by: Tier, Outcome, Stage, Has LinkedIn, Has Email. Searchable by name/company.

Each contact row expands to show:
- All action dates with status indicators
- Generated messages panel (collapsed by default, expand to copy)
- Edit button
- Log action button (adds to `actions_log`)

### 8.4 `/dashboard/companies`
Company list. Sorted by Tier then creation date. Shows contact count per company.
Add/edit company modal. Click company to see all linked contacts.

### 8.5 `/dashboard/context`
Form to edit `user_context`. Fields map 1:1 to the schema above.
Shows a preview of what the AI system prompt looks like with current context filled in.
Save button triggers re-generation of all existing messages (optional, user confirms).

### 8.6 `/dashboard/log`
Activity feed from `actions_log`. Shows all actions taken, newest first.
Weekly summary: emails sent, LI actions, replies received, Loom views.
Used for Friday metrics check from playbook.

---

## 9. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/apify/trigger` | POST | Start Apify scrape for a contact |
| `/api/generate` | POST | Call OpenRouter, save to generated_messages |
| `/api/webhooks/apify` | POST | Receive Apify scrape results, trigger generation |
| `/api/webhooks/loom` | POST | Future: auto-set loom_viewed_at when Loom notifies |

---

## 10. Project File Structure

```
war-room/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx            ← sidebar + topbar
│   │   ├── page.tsx              ← War Room (Today's Actions)
│   │   ├── pipeline/
│   │   │   └── page.tsx
│   │   ├── companies/
│   │   │   └── page.tsx
│   │   ├── context/
│   │   │   └── page.tsx
│   │   └── log/
│   │       └── page.tsx
│   └── api/
│       ├── apify/
│       │   └── trigger/route.ts
│       ├── generate/route.ts
│       └── webhooks/
│           ├── apify/route.ts
│           └── loom/route.ts
├── components/
│   ├── ContactRow.tsx            ← row in Today's Actions
│   ├── ContactCard.tsx           ← expanded contact in pipeline
│   ├── CompanyCard.tsx
│   ├── ActionButton.tsx          ← single-tap date setter
│   ├── GeneratedMessages.tsx     ← collapsible message panel with copy buttons
│   ├── StatsBar.tsx
│   ├── TodayActions.tsx          ← War Room main list
│   ├── HotLeads.tsx
│   └── Filters.tsx
├── lib/
│   ├── priority.ts               ← computeNextAction(), computePriorityScore(), daysSinceLastTouch()
│   ├── openrouter.ts             ← generateMessages()
│   ├── apify.ts                  ← triggerScrape(), parseApifyResult()
│   ├── prompts.ts                ← buildSystemPrompt(), buildUserPrompt()
│   └── supabase.ts               ← createClient() for server + client
├── types/
│   └── index.ts                  ← Contact, Company, GeneratedMessages, UserContext types
├── supabase/
│   └── schema.sql                ← full schema with RLS policies
└── .env.local
    ├── NEXT_PUBLIC_SUPABASE_URL
    ├── NEXT_PUBLIC_SUPABASE_ANON_KEY
    ├── OPENROUTER_API_KEY
    └── APIFY_API_TOKEN
```

---

## 11. Key UI/UX Decisions

- **Default page is War Room** — not pipeline, not companies. Open app = see today's tasks immediately.
- **Action buttons show only the current next step** — no cognitive load, one obvious thing to tap.
- **Messages are collapsed by default** — contact rows are compact; expand to copy messages.
- **Apify + generation is async and non-blocking** — adding a contact is instant; messages appear in background.
- **Priority re-computes on every render** — no stale data; tapping an action button instantly resorts the list.
- **Copy buttons on every message** — one click to clipboard, no selecting text.
- **Tier 1 contacts are visually distinct** — use accent colour border or badge on all Tier 1 rows throughout the app.
- **Days Since Touch shown in red when > 7** — visual urgency signal without needing to read the number carefully.

---

## 12. Out of Scope (v1)

The following are intentionally excluded from v1 to keep scope tight:

- Email sending integration (use Gmail/custom domain manually)
- LinkedIn automation (manual actions only, system generates the text)
- n8n webhook triggers (Supabase Realtime handles UI updates; n8n can be added in v2)
- Mobile app (responsive web is sufficient)
- Multiple users / team features
- CSV bulk import (add leads manually or build this in v2)
- Loom API webhook (manual checkbox is fine for v1)

---

## 13. Success Criteria

The system is working correctly when:

1. Adding a contact with a LinkedIn URL triggers an Apify scrape and produces generated messages within 60 seconds, with no manual steps beyond saving the contact.
2. Opening `/dashboard` shows today's action list sorted correctly, with the highest priority lead (Replied > Loom Viewed > Tier 1 email due > Tier 1 LI step) at the top.
3. Tapping an action button (e.g., "👁 Done — Visited") updates the contact's date field and instantly recalculates and re-sorts the list without a page reload.
4. Generated messages are specific enough that a CTO receiving them would not recognise them as AI-generated — they reference actual post content, company details, and the sender's real project metrics.
5. The full pipeline of 100 contacts is manageable in under 30 minutes per day using only the War Room view.

---

## 14. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # for server-side API routes only

# OpenRouter
OPENROUTER_API_KEY=              # for /api/generate route

# Apify
APIFY_API_TOKEN=                 # for /api/apify/trigger route
APIFY_WEBHOOK_SECRET=            # validate incoming webhooks
```

---

*End of Document*
