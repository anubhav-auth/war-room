-- Add linkedin_url column to companies table
ALTER TABLE companies ADD COLUMN linkedin_url TEXT DEFAULT NULL;

-- Create index for faster lookups
CREATE INDEX idx_companies_linkedin_url ON companies(linkedin_url);
