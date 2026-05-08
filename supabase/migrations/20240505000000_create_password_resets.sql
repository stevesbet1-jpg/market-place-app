-- Create password_resets table for custom email reset flow
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);

-- Create index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);

-- Enable RLS
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert (for Edge Function)
CREATE POLICY "Service role can insert password resets"
  ON password_resets
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow service role to select (for Edge Function)
CREATE POLICY "Service role can select password resets"
  ON password_resets
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service role to update (for marking as used)
CREATE POLICY "Service role can update password resets"
  ON password_resets
  FOR UPDATE
  TO service_role
  WITH CHECK (true);
