-- Migration: Add users table and owner_id to workflows
-- Run this manually or via Alembic later

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_email_not_empty CHECK (length(email) > 0),
    CONSTRAINT users_username_not_empty CHECK (length(username) > 0)
);

-- Add owner_id to workflows table
ALTER TABLE workflows
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create index for owner queries
CREATE INDEX IF NOT EXISTS idx_workflows_owner_id ON workflows(owner_id);

-- Add owner_id to workflow_runs (for direct ownership tracking)
ALTER TABLE workflow_runs
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_owner_id ON workflow_runs(owner_id);

-- Create a default development user
INSERT INTO users (id, email, username, full_name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dev@localhost',
    'dev',
    'Development User'
) ON CONFLICT (email) DO NOTHING;

-- Update existing workflows to belong to dev user
UPDATE workflows SET owner_id = '00000000-0000-0000-0000-000000000001' WHERE owner_id IS NULL;

-- Make owner_id required going forward (uncomment after backfill)
-- ALTER TABLE workflows ALTER COLUMN owner_id SET NOT NULL;

-- Trigger to auto-update updated_at on users
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'Application users with workflow ownership';
COMMENT ON COLUMN workflows.owner_id IS 'User who created/owns this workflow';
COMMENT ON COLUMN workflow_runs.owner_id IS 'User who initiated this workflow run';
