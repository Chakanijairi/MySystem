-- Run once as a PostgreSQL superuser (often "postgres"), e.g.:
--   psql -U postgres -f backend/db/setup-local-role.sql
-- Or paste into pgAdmin Query Tool.

CREATE USER pern WITH PASSWORD 'pern';
CREATE DATABASE dealer_monitoring OWNER pern;
