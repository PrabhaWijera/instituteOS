-- NexClass — PostgreSQL initialization script
-- Runs automatically when the postgres container starts for the first time.
-- Mounts via docker-compose: ./scripts/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql

-- Enable pg_stat_statements so slow queries can be diagnosed without external tooling.
-- Query: SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
