-- Agent Platform Database Schema
-- PostgreSQL 16+ required for enhanced features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types for status tracking
CREATE TYPE workflow_run_status AS ENUM ('running', 'completed', 'failed');
CREATE TYPE node_status AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');
CREATE TYPE event_type AS ENUM (
    'workflow_start',
    'workflow_complete',
    'node_start',
    'node_progress',
    'node_stream',
    'node_complete',
    'error',
    'log',
    'metric'
);

-- Workflows table
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    definition JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workflows_name_not_empty CHECK (length(name) > 0)
);

-- Workflow runs table
CREATE TABLE workflow_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status workflow_run_status NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT workflow_runs_completion_time CHECK (
        (status = 'running' AND completed_at IS NULL) OR
        (status IN ('completed', 'failed') AND completed_at IS NOT NULL)
    )
);

-- Node executions table
CREATE TABLE node_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL,
    node_type VARCHAR(100) NOT NULL,
    status node_status NOT NULL DEFAULT 'pending',
    inputs JSONB,
    outputs JSONB,
    tokens_used INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT node_executions_tokens_positive CHECK (tokens_used IS NULL OR tokens_used >= 0),
    CONSTRAINT node_executions_completion_time CHECK (
        (status IN ('pending', 'running') AND completed_at IS NULL) OR
        (status IN ('completed', 'failed', 'skipped') AND completed_at IS NOT NULL)
    )
);

-- Execution events table (for full replay and debugging)
CREATE TABLE execution_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type event_type NOT NULL,
    event_data JSONB NOT NULL,
    node_id VARCHAR(255)
);

-- Indexes for common query patterns
CREATE INDEX idx_workflows_created_at ON workflows(created_at DESC);
CREATE INDEX idx_workflows_updated_at ON workflows(updated_at DESC);

CREATE INDEX idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_started_at ON workflow_runs(started_at DESC);

CREATE INDEX idx_node_executions_run_id ON node_executions(run_id);
CREATE INDEX idx_node_executions_status ON node_executions(status);
CREATE INDEX idx_node_executions_node_type ON node_executions(node_type);

CREATE INDEX idx_execution_events_run_id ON execution_events(run_id);
CREATE INDEX idx_execution_events_timestamp ON execution_events(timestamp DESC);
CREATE INDEX idx_execution_events_event_type ON execution_events(event_type);

-- Optional: GIN indexes for JSONB queries (uncomment if needed for complex JSON queries)
-- CREATE INDEX idx_workflows_definition_gin ON workflows USING GIN (definition);
-- CREATE INDEX idx_node_executions_inputs_gin ON node_executions USING GIN (inputs);
-- CREATE INDEX idx_node_executions_outputs_gin ON node_executions USING GIN (outputs);
-- CREATE INDEX idx_execution_events_data_gin ON execution_events USING GIN (event_data);

-- Trigger to auto-update updated_at on workflows
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-complete workflow run when all nodes are done
CREATE OR REPLACE FUNCTION check_workflow_completion()
RETURNS TRIGGER AS $$
DECLARE
    pending_count INTEGER;
    failed_count INTEGER;
BEGIN
    -- Count pending/running nodes for this run
    SELECT COUNT(*) INTO pending_count
    FROM node_executions
    WHERE run_id = NEW.run_id
    AND status IN ('pending', 'running');

    -- If no pending nodes, update workflow run status
    IF pending_count = 0 THEN
        -- Count failed nodes
        SELECT COUNT(*) INTO failed_count
        FROM node_executions
        WHERE run_id = NEW.run_id
        AND status = 'failed';

        -- Update workflow run status
        IF failed_count > 0 THEN
            UPDATE workflow_runs
            SET status = 'failed', completed_at = NOW()
            WHERE id = NEW.run_id AND status = 'running';
        ELSE
            UPDATE workflow_runs
            SET status = 'completed', completed_at = NOW()
            WHERE id = NEW.run_id AND status = 'running';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_workflow_completion
    AFTER UPDATE ON node_executions
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION check_workflow_completion();

-- Partitioning setup for execution_events (optional, for high-volume scenarios)
-- Uncomment if you expect >1M events and want to partition by month
-- CREATE TABLE execution_events_template (LIKE execution_events INCLUDING ALL);
-- CREATE TABLE execution_events_2025_01 PARTITION OF execution_events
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- View for run summaries with aggregated metrics
CREATE OR REPLACE VIEW workflow_run_summaries AS
SELECT
    wr.id AS run_id,
    wr.workflow_id,
    w.name AS workflow_name,
    wr.status,
    wr.started_at,
    wr.completed_at,
    EXTRACT(EPOCH FROM (COALESCE(wr.completed_at, NOW()) - wr.started_at)) AS duration_seconds,
    COUNT(ne.id) AS total_nodes,
    COUNT(ne.id) FILTER (WHERE ne.status = 'completed') AS completed_nodes,
    COUNT(ne.id) FILTER (WHERE ne.status = 'failed') AS failed_nodes,
    SUM(ne.tokens_used) AS total_tokens,
    wr.error_message
FROM workflow_runs wr
JOIN workflows w ON w.id = wr.workflow_id
LEFT JOIN node_executions ne ON ne.run_id = wr.id
GROUP BY wr.id, wr.workflow_id, w.name, wr.status, wr.started_at, wr.completed_at, wr.error_message;

-- Grant permissions (adjust for your needs)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agent;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agent;

-- Insert a sample workflow for testing (optional)
-- INSERT INTO workflows (name, definition)
-- VALUES ('Sample Workflow', '{"nodes": [], "edges": []}');

COMMENT ON TABLE workflows IS 'Stores workflow definitions with nodes and edges';
COMMENT ON TABLE workflow_runs IS 'Tracks individual workflow executions';
COMMENT ON TABLE node_executions IS 'Records execution of individual nodes within a run';
COMMENT ON TABLE execution_events IS 'Stores detailed event stream for replay and debugging';
COMMENT ON VIEW workflow_run_summaries IS 'Aggregated view of workflow runs with metrics';
