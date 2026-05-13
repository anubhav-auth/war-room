export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_context: {
        Row: {
          id: string
          user_id: string
          name: string
          current_role: string | null
          years_exp: string | null
          location: string | null
          headline: string | null
          loom_url: string | null
          portfolio_url: string | null
          github_url: string | null
          linkedin_url: string | null
          projects: Json | null
          primary_stack: string | null
          specialisation: string | null
          target_role: string | null
          target_stage: string | null
          open_to: string | null
          email_tone: string | null
          li_tone: string | null
          extra_context: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          current_role?: string | null
          years_exp?: string | null
          location?: string | null
          headline?: string | null
          loom_url?: string | null
          portfolio_url?: string | null
          github_url?: string | null
          linkedin_url?: string | null
          projects?: Json | null
          primary_stack?: string | null
          specialisation?: string | null
          target_role?: string | null
          target_stage?: string | null
          open_to?: string | null
          email_tone?: string | null
          li_tone?: string | null
          extra_context?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          current_role?: string | null
          years_exp?: string | null
          location?: string | null
          headline?: string | null
          loom_url?: string | null
          portfolio_url?: string | null
          github_url?: string | null
          linkedin_url?: string | null
          projects?: Json | null
          primary_stack?: string | null
          specialisation?: string | null
          target_role?: string | null
          target_stage?: string | null
          open_to?: string | null
          email_tone?: string | null
          li_tone?: string | null
          extra_context?: string | null
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          user_id: string
          name: string
          tier: number
          funding_stage: string | null
          funding_date: string | null
          employee_count: number | null
          tech_stack: string[] | null
          source: string | null
          job_posting_url: string | null
          website_url: string | null
          notes: string | null
          created_at: string
          linkedin_url: string | null
          description: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          tier?: number
          funding_stage?: string | null
          funding_date?: string | null
          employee_count?: number | null
          tech_stack?: string[] | null
          source?: string | null
          job_posting_url?: string | null
          website_url?: string | null
          notes?: string | null
          created_at?: string
          linkedin_url?: string | null
          description?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          tier?: number
          funding_stage?: string | null
          funding_date?: string | null
          employee_count?: number | null
          tech_stack?: string[] | null
          source?: string | null
          job_posting_url?: string | null
          website_url?: string | null
          notes?: string | null
          created_at?: string
          linkedin_url?: string | null
          description?: string | null
        }
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          name: string
          title: string | null
          contact_type: 'cto_founder' | 'lead_eng' | 'other'
          linkedin_url: string | null
          email: string | null
          notes: string | null
          outcome: 'active' | 'rejected' | 'ghosted' | 'no_role' | 'hired' | 'referral'
          reply_channel: 'linkedin' | 'email' | null
          li_visited_at: string | null
          li_commented_at: string | null
          li_connection_sent_at: string | null
          li_connected_at: string | null
          li_message_sent_at: string | null
          email1_sent_at: string | null
          email2_sent_at: string | null
          email3_sent_at: string | null
          loom_viewed_at: string | null
          replied_at: string | null
          call_booked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          name: string
          title?: string | null
          contact_type?: 'cto_founder' | 'lead_eng' | 'other'
          linkedin_url?: string | null
          email?: string | null
          notes?: string | null
          outcome?: 'active' | 'rejected' | 'ghosted' | 'no_role' | 'hired' | 'referral'
          reply_channel?: 'linkedin' | 'email' | null
          li_visited_at?: string | null
          li_commented_at?: string | null
          li_connection_sent_at?: string | null
          li_connected_at?: string | null
          li_message_sent_at?: string | null
          email1_sent_at?: string | null
          email2_sent_at?: string | null
          email3_sent_at?: string | null
          loom_viewed_at?: string | null
          replied_at?: string | null
          call_booked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          name?: string
          title?: string | null
          contact_type?: 'cto_founder' | 'lead_eng' | 'other'
          linkedin_url?: string | null
          email?: string | null
          notes?: string | null
          outcome?: 'active' | 'rejected' | 'ghosted' | 'no_role' | 'hired' | 'referral'
          reply_channel?: 'linkedin' | 'email' | null
          li_visited_at?: string | null
          li_commented_at?: string | null
          li_connection_sent_at?: string | null
          li_connected_at?: string | null
          li_message_sent_at?: string | null
          email1_sent_at?: string | null
          email2_sent_at?: string | null
          email3_sent_at?: string | null
          loom_viewed_at?: string | null
          replied_at?: string | null
          call_booked_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      linkedin_profiles: {
        Row: {
          id: string
          contact_id: string
          headline: string | null
          about: string | null
          current_company_description: string | null
          experience: Json | null
          skills: Json | null
          recent_posts: Json | null
          articles: Json | null
          scraped_at: string
          apify_run_id: string | null
          raw_data: Json | null
        }
        Insert: {
          id?: string
          contact_id: string
          headline?: string | null
          about?: string | null
          current_company_description?: string | null
          experience?: Json | null
          skills?: Json | null
          recent_posts?: Json | null
          articles?: Json | null
          scraped_at?: string
          apify_run_id?: string | null
          raw_data?: Json | null
        }
        Update: {
          id?: string
          contact_id?: string
          headline?: string | null
          about?: string | null
          current_company_description?: string | null
          experience?: Json | null
          skills?: Json | null
          recent_posts?: Json | null
          articles?: Json | null
          scraped_at?: string
          apify_run_id?: string | null
          raw_data?: Json | null
        }
      }
      generated_messages: {
        Row: {
          id: string
          contact_id: string
          li_comment: string | null
          li_connection_note: string | null
          li_message: string | null
          email1_subject: string | null
          email1_body: string | null
          email2_subject: string | null
          email2_body: string | null
          email3_subject: string | null
          email3_body: string | null
          generated_at: string
          model_used: string
          prompt_version: number
          manually_regenerated: boolean
        }
        Insert: {
          id?: string
          contact_id: string
          li_comment?: string | null
          li_connection_note?: string | null
          li_message?: string | null
          email1_subject?: string | null
          email1_body?: string | null
          email2_subject?: string | null
          email2_body?: string | null
          email3_subject?: string | null
          email3_body?: string | null
          generated_at?: string
          model_used?: string
          prompt_version?: number
          manually_regenerated?: boolean
        }
        Update: {
          id?: string
          contact_id?: string
          li_comment?: string | null
          li_connection_note?: string | null
          li_message?: string | null
          email1_subject?: string | null
          email1_body?: string | null
          email2_subject?: string | null
          email2_body?: string | null
          email3_subject?: string | null
          email3_body?: string | null
          generated_at?: string
          model_used?: string
          prompt_version?: number
          manually_regenerated?: boolean
        }
      }
      actions_log: {
        Row: {
          id: string
          contact_id: string | null
          user_id: string
          action_type: string
          notes: string | null
          outcome: 'positive' | 'neutral' | 'negative' | 'pending'
          created_at: string
        }
        Insert: {
          id?: string
          contact_id?: string | null
          user_id: string
          action_type: string
          notes?: string | null
          outcome?: 'positive' | 'neutral' | 'negative' | 'pending'
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string | null
          user_id?: string
          action_type?: string
          notes?: string | null
          outcome?: 'positive' | 'neutral' | 'negative' | 'pending'
          created_at?: string
        }
      }
      email_permutations: {
        Row: {
          id: string
          contact_id: string
          email: string
          status: 'pending' | 'valid' | 'invalid' | 'catch_all' | 'unknown' | 'skipped'
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          email: string
          status?: 'pending' | 'valid' | 'invalid' | 'catch_all' | 'unknown' | 'skipped'
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          email?: string
          status?: 'pending' | 'valid' | 'invalid' | 'catch_all' | 'unknown' | 'skipped'
          metadata?: Json | null
          created_at?: string
        }
      }
      contact_process_logs: {
        Row: {
          id: string
          contact_id: string
          user_id: string
          stage: 'created' | 'linkedin_scraping_triggered' | 'linkedin_scraped' | 'posts_scraped' | 'emails_generated' | 'messages_generated' | 'failed'
          status: 'success' | 'failed' | 'pending'
          details: Json | null
          error: string | null
          attempt: number | null
          timestamp: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          contact_id: string
          user_id: string
          stage: 'created' | 'linkedin_scraping_triggered' | 'linkedin_scraped' | 'posts_scraped' | 'emails_generated' | 'messages_generated' | 'failed'
          status: 'success' | 'failed' | 'pending'
          details?: Json | null
          error?: string | null
          attempt?: number | null
          timestamp?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          contact_id?: string
          user_id?: string
          stage?: 'created' | 'linkedin_scraping_triggered' | 'linkedin_scraped' | 'posts_scraped' | 'emails_generated' | 'messages_generated' | 'failed'
          status?: 'success' | 'failed' | 'pending'
          details?: Json | null
          error?: string | null
          attempt?: number | null
          timestamp?: string | null
          created_at?: string | null
        }
      }
    }
  }
}

export type Contact = Database['public']['Tables']['contacts']['Row']
export type Company = Database['public']['Tables']['companies']['Row']
export type UserContext = Database['public']['Tables']['user_context']['Row']
export type LinkedInProfile = Database['public']['Tables']['linkedin_profiles']['Row']
export type GeneratedMessage = Database['public']['Tables']['generated_messages']['Row']
export type ActionLog = Database['public']['Tables']['actions_log']['Row']
export type EmailPermutation = Database['public']['Tables']['email_permutations']['Row']
export type ContactProcessLog = Database['public']['Tables']['contact_process_logs']['Row']
