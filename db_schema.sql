--
-- PostgreSQL database dump
--

\restrict Ay1ZPm774fwpC4dyQDaYf23Jur4pig6asiSiwoayRbRrp4rbvCKGM6ILChwM9qu

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3 (Ubuntu 18.3-1.pgdg22.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actions_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actions_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    user_id uuid NOT NULL,
    action_type text NOT NULL,
    notes text,
    outcome text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT actions_log_outcome_check CHECK ((outcome = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text, 'pending'::text])))
);


ALTER TABLE public.actions_log OWNER TO postgres;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    tier integer DEFAULT 2,
    funding_stage text,
    funding_date date,
    employee_count integer,
    tech_stack text[],
    source text,
    job_posting_url text,
    website_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    linkedin_url text,
    description text,
    CONSTRAINT companies_tier_check CHECK ((tier = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- Name: company_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    name text,
    industry text,
    website text,
    company_size text,
    headcount integer,
    about text,
    specialties text[],
    headquarters text,
    founded text,
    scraped_at timestamp with time zone DEFAULT now(),
    apify_run_id text,
    raw_data jsonb,
    user_id uuid NOT NULL
);


ALTER TABLE public.company_profiles OWNER TO postgres;

--
-- Name: contact_process_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_process_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid NOT NULL,
    user_id uuid NOT NULL,
    stage text NOT NULL,
    status text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    error text,
    attempt integer DEFAULT 1,
    "timestamp" timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contact_process_logs_stage_check CHECK ((stage = ANY (ARRAY['created'::text, 'linkedin_scraping_triggered'::text, 'linkedin_scraped'::text, 'posts_scraped'::text, 'emails_generated'::text, 'messages_generated'::text, 'failed'::text]))),
    CONSTRAINT contact_process_logs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text, 'pending'::text])))
);


ALTER TABLE public.contact_process_logs OWNER TO postgres;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid,
    name text NOT NULL,
    title text,
    contact_type text DEFAULT 'cto_founder'::text,
    linkedin_url text,
    email text,
    notes text,
    outcome text DEFAULT 'active'::text,
    reply_channel text,
    li_visited_at date,
    li_commented_at date,
    li_connection_sent_at date,
    li_connected_at date,
    li_message_sent_at date,
    email1_sent_at date,
    email2_sent_at date,
    email3_sent_at date,
    loom_viewed_at date,
    replied_at date,
    call_booked_at date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contacts_contact_type_check CHECK ((contact_type = ANY (ARRAY['cto_founder'::text, 'lead_eng'::text, 'other'::text]))),
    CONSTRAINT contacts_outcome_check CHECK ((outcome = ANY (ARRAY['active'::text, 'rejected'::text, 'ghosted'::text, 'no_role'::text, 'hired'::text, 'referral'::text]))),
    CONSTRAINT contacts_reply_channel_check CHECK ((reply_channel = ANY (ARRAY['linkedin'::text, 'email'::text])))
);


ALTER TABLE public.contacts OWNER TO postgres;

--
-- Name: email_permutations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_permutations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    email text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT email_permutations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'valid'::text, 'invalid'::text, 'catch_all'::text, 'unknown'::text, 'skipped'::text])))
);


ALTER TABLE public.email_permutations OWNER TO postgres;

--
-- Name: generated_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.generated_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    li_comment text,
    li_connection_note text,
    li_message text,
    email1_subject text,
    email1_body text,
    email2_subject text,
    email2_body text,
    email3_subject text,
    email3_body text,
    generated_at timestamp with time zone DEFAULT now(),
    model_used text DEFAULT 'minimax/minimax-text-01'::text,
    prompt_version integer DEFAULT 1,
    manually_regenerated boolean DEFAULT false
);


ALTER TABLE public.generated_messages OWNER TO postgres;

--
-- Name: linkedin_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.linkedin_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_id uuid,
    headline text,
    about text,
    current_company_description text,
    experience jsonb DEFAULT '[]'::jsonb,
    skills jsonb DEFAULT '[]'::jsonb,
    recent_posts jsonb DEFAULT '[]'::jsonb,
    articles jsonb DEFAULT '[]'::jsonb,
    scraped_at timestamp with time zone DEFAULT now(),
    apify_run_id text,
    raw_data jsonb
);


ALTER TABLE public.linkedin_profiles OWNER TO postgres;

--
-- Name: user_context; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_context (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    "current_role" text,
    years_exp text,
    location text,
    headline text,
    loom_url text,
    portfolio_url text,
    github_url text,
    linkedin_url text,
    projects jsonb DEFAULT '[]'::jsonb,
    primary_stack text,
    specialisation text,
    target_role text,
    target_stage text,
    open_to text,
    email_tone text,
    li_tone text,
    extra_context text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_context OWNER TO postgres;

--
-- Name: actions_log actions_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions_log
    ADD CONSTRAINT actions_log_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_profiles company_profiles_company_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_profiles
    ADD CONSTRAINT company_profiles_company_id_key UNIQUE (company_id);


--
-- Name: company_profiles company_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_profiles
    ADD CONSTRAINT company_profiles_pkey PRIMARY KEY (id);


--
-- Name: contact_process_logs contact_process_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_process_logs
    ADD CONSTRAINT contact_process_logs_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: email_permutations email_permutations_contact_id_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_permutations
    ADD CONSTRAINT email_permutations_contact_id_email_key UNIQUE (contact_id, email);


--
-- Name: email_permutations email_permutations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_permutations
    ADD CONSTRAINT email_permutations_pkey PRIMARY KEY (id);


--
-- Name: generated_messages generated_messages_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_messages
    ADD CONSTRAINT generated_messages_contact_id_key UNIQUE (contact_id);


--
-- Name: generated_messages generated_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_messages
    ADD CONSTRAINT generated_messages_pkey PRIMARY KEY (id);


--
-- Name: linkedin_profiles linkedin_profiles_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linkedin_profiles
    ADD CONSTRAINT linkedin_profiles_contact_id_key UNIQUE (contact_id);


--
-- Name: linkedin_profiles linkedin_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linkedin_profiles
    ADD CONSTRAINT linkedin_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_context user_context_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_context
    ADD CONSTRAINT user_context_pkey PRIMARY KEY (id);


--
-- Name: user_context user_context_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_context
    ADD CONSTRAINT user_context_user_id_key UNIQUE (user_id);


--
-- Name: idx_companies_linkedin_url; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_companies_linkedin_url ON public.companies USING btree (linkedin_url);


--
-- Name: idx_contact_process_logs_contact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_process_logs_contact_id ON public.contact_process_logs USING btree (contact_id);


--
-- Name: idx_contact_process_logs_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_process_logs_stage ON public.contact_process_logs USING btree (stage);


--
-- Name: idx_contact_process_logs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_process_logs_status ON public.contact_process_logs USING btree (status);


--
-- Name: idx_contact_process_logs_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_process_logs_timestamp ON public.contact_process_logs USING btree ("timestamp" DESC);


--
-- Name: idx_contact_process_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_process_logs_user_id ON public.contact_process_logs USING btree (user_id);


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_context update_user_context_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_context_updated_at BEFORE UPDATE ON public.user_context FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: actions_log actions_log_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions_log
    ADD CONSTRAINT actions_log_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: actions_log actions_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actions_log
    ADD CONSTRAINT actions_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: companies companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: company_profiles company_profiles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_profiles
    ADD CONSTRAINT company_profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_profiles company_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_profiles
    ADD CONSTRAINT company_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: contact_process_logs contact_process_logs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_process_logs
    ADD CONSTRAINT contact_process_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_process_logs contact_process_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_process_logs
    ADD CONSTRAINT contact_process_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: contacts contacts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: email_permutations email_permutations_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_permutations
    ADD CONSTRAINT email_permutations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: generated_messages generated_messages_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_messages
    ADD CONSTRAINT generated_messages_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: linkedin_profiles linkedin_profiles_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linkedin_profiles
    ADD CONSTRAINT linkedin_profiles_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: user_context user_context_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_context
    ADD CONSTRAINT user_context_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: actions_log Users see own actions_log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users see own actions_log" ON public.actions_log USING ((user_id = auth.uid()));


--
-- Name: companies Users see own companies; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users see own companies" ON public.companies USING ((user_id = auth.uid()));


--
-- Name: company_profiles Users see own company_profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users see own company_profiles" ON public.company_profiles USING ((user_id = auth.uid()));


--
-- Name: contacts Users see own contacts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users see own contacts" ON public.contacts USING ((user_id = auth.uid()));


--
-- Name: user_context Users see own context; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users see own context" ON public.user_context USING ((user_id = auth.uid()));


--
-- Name: generated_messages Users see own generated_messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users see own generated_messages" ON public.generated_messages USING ((EXISTS ( SELECT 1
   FROM public.contacts
  WHERE ((contacts.id = generated_messages.contact_id) AND (contacts.user_id = auth.uid())))));


--
-- Name: linkedin_profiles Users see own linkedin_profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users see own linkedin_profiles" ON public.linkedin_profiles USING ((EXISTS ( SELECT 1
   FROM public.contacts
  WHERE ((contacts.id = linkedin_profiles.contact_id) AND (contacts.user_id = auth.uid())))));


--
-- Name: email_permutations Users see own permutations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users see own permutations" ON public.email_permutations USING ((EXISTS ( SELECT 1
   FROM public.contacts
  WHERE ((contacts.id = email_permutations.contact_id) AND (contacts.user_id = auth.uid())))));


--
-- Name: contact_process_logs Users see their contact logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users see their contact logs" ON public.contact_process_logs USING ((EXISTS ( SELECT 1
   FROM public.contacts
  WHERE ((contacts.id = contact_process_logs.contact_id) AND (contacts.user_id = auth.uid())))));


--
-- Name: actions_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.actions_log ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: company_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_process_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contact_process_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: email_permutations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_permutations ENABLE ROW LEVEL SECURITY;

--
-- Name: generated_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.generated_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.linkedin_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_context; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;

--
-- Name: TABLE actions_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.actions_log TO anon;
GRANT ALL ON TABLE public.actions_log TO authenticated;
GRANT ALL ON TABLE public.actions_log TO service_role;


--
-- Name: TABLE companies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.companies TO anon;
GRANT ALL ON TABLE public.companies TO authenticated;
GRANT ALL ON TABLE public.companies TO service_role;


--
-- Name: TABLE company_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.company_profiles TO anon;
GRANT ALL ON TABLE public.company_profiles TO authenticated;
GRANT ALL ON TABLE public.company_profiles TO service_role;


--
-- Name: TABLE contact_process_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contact_process_logs TO anon;
GRANT ALL ON TABLE public.contact_process_logs TO authenticated;
GRANT ALL ON TABLE public.contact_process_logs TO service_role;


--
-- Name: TABLE contacts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contacts TO anon;
GRANT ALL ON TABLE public.contacts TO authenticated;
GRANT ALL ON TABLE public.contacts TO service_role;


--
-- Name: TABLE email_permutations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_permutations TO anon;
GRANT ALL ON TABLE public.email_permutations TO authenticated;
GRANT ALL ON TABLE public.email_permutations TO service_role;


--
-- Name: TABLE generated_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.generated_messages TO anon;
GRANT ALL ON TABLE public.generated_messages TO authenticated;
GRANT ALL ON TABLE public.generated_messages TO service_role;


--
-- Name: TABLE linkedin_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.linkedin_profiles TO anon;
GRANT ALL ON TABLE public.linkedin_profiles TO authenticated;
GRANT ALL ON TABLE public.linkedin_profiles TO service_role;


--
-- Name: TABLE user_context; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_context TO anon;
GRANT ALL ON TABLE public.user_context TO authenticated;
GRANT ALL ON TABLE public.user_context TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict Ay1ZPm774fwpC4dyQDaYf23Jur4pig6asiSiwoayRbRrp4rbvCKGM6ILChwM9qu

