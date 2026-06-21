-- DVAS P0 database bootstrap
-- Usage:
--   psql -U postgres -d postgres -f dvas_p0_00_create_database.sql
-- Notes:
--   The CREATE DATABASE block uses psql \gexec and should be run in psql.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dvas_app') THEN
        CREATE ROLE dvas_app LOGIN PASSWORD 'password';
    ELSE
        ALTER ROLE dvas_app WITH LOGIN PASSWORD 'password';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dvas_readonly') THEN
        CREATE ROLE dvas_readonly LOGIN PASSWORD 'readonly_password';
    ELSE
        ALTER ROLE dvas_readonly WITH LOGIN PASSWORD 'readonly_password';
    END IF;
END
$$;

SELECT 'CREATE DATABASE dvas_p0 OWNER dvas_app ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'dvas_p0')\gexec
