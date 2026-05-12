-- Add columns to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS description text;

-- Create company_profiles table
CREATE TABLE IF NOT EXISTS company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  
  -- Scraped fields
  name text,
  industry text,
  website text,
  company_size text,
  headcount int,
  about text,
  specialties text[],
  headquarters text,
  founded text,
  
  -- Meta
  scraped_at timestamptz DEFAULT now(),
  apify_run_id text,
  raw_data jsonb,
  
  user_id uuid REFERENCES auth.users NOT NULL
);

-- Security
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own company_profiles" ON company_profiles;
CREATE POLICY "Users see own company_profiles" ON company_profiles FOR ALL USING (user_id = auth.uid());
