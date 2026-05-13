import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const migrationSQL = `
create table if not exists contact_process_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  
  stage text not null check (stage in (
    'created',
    'linkedin_scraping_triggered',
    'linkedin_scraped',
    'posts_scraped',
    'emails_generated',
    'messages_generated',
    'failed'
  )),
  
  status text not null check (status in ('success', 'failed', 'pending')),
  details jsonb default '{}',
  error text,
  
  attempt int default 1,
  timestamp timestamptz default now(),
  
  created_at timestamptz default now()
);

create index if not exists idx_contact_process_logs_contact_id on contact_process_logs(contact_id);
create index if not exists idx_contact_process_logs_user_id on contact_process_logs(user_id);
create index if not exists idx_contact_process_logs_stage on contact_process_logs(stage);
create index if not exists idx_contact_process_logs_status on contact_process_logs(status);
create index if not exists idx_contact_process_logs_timestamp on contact_process_logs(timestamp desc);

alter table contact_process_logs enable row level security;

drop policy if exists "Users see their contact logs" on contact_process_logs;
create policy "Users see their contact logs" on contact_process_logs for all using (
  exists (
    select 1 from contacts 
    where contacts.id = contact_process_logs.contact_id 
    and contacts.user_id = auth.uid()
  )
);
`;

export async function POST(request: NextRequest) {
  try {
    // Verify request secret
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.MIGRATION_SECRET || "migration-secret";

    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();

    console.log("Starting migration: contact_process_logs table");

    // Try to query the table to see if it exists
    try {
      const { error: checkError } = await adminClient
        .from("contact_process_logs")
        .select("id", { count: "exact" })
        .limit(0);

      if (checkError && checkError.code === "42P01") {
        // Table doesn't exist
        console.log("Table doesn't exist yet. Migration required.");
        
        return NextResponse.json({
          status: "pending",
          message: "contact_process_logs table does not exist and needs to be created",
          migration: "20240515000000_contact_process_logs",
          instructions: {
            step1: "Visit Supabase SQL Editor",
            step2: "Create new query",
            step3: "Run the SQL from supabase/migrations/20240515000000_contact_process_logs.sql",
            dashboard_url: "https://app.supabase.com/project/ooqvvmyopgynxjcgdvwa/sql"
          }
        }, { status: 202 });
      }

      if (checkError) {
        throw checkError;
      }
    } catch (err) {
      console.log("Error checking table:", err);
    }

    // Verify table is accessible
    const { error: verifyError } = await adminClient
      .from("contact_process_logs")
      .select("id", { count: "exact" })
      .limit(0);

    if (verifyError) {
      if (verifyError.code === "42P01") {
        return NextResponse.json({
          status: "not_created",
          message: "contact_process_logs table does not exist",
          action: "Apply the migration SQL via Supabase dashboard"
        }, { status: 202 });
      }
      
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to verify table",
          error: verifyError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      message: "contact_process_logs table created successfully",
      migration: "20240515000000_contact_process_logs",
    });
  } catch (err) {
    console.error("Migration error:", err);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
