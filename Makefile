SHELL := /bin/sh

COMPOSE ?= docker compose
POSTGRES_SERVICE ?= postgres
POSTGRES_ADMIN_DB ?= postgres
POSTGRES_ADMIN_USER ?= postgres
POSTGRES_ADMIN_PASSWORD ?= postgres
DVAS_DB_NAME ?= dvas_p0
DVAS_DB_USER ?= dvas_app
DVAS_DB_PASSWORD ?= password
DATABASE_URL ?= postgresql://$(DVAS_DB_USER):$(DVAS_DB_PASSWORD)@localhost:5432/$(DVAS_DB_NAME)

ADMIN_PSQL = $(COMPOSE) exec -T -e PGPASSWORD=$(POSTGRES_ADMIN_PASSWORD) $(POSTGRES_SERVICE) psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U $(POSTGRES_ADMIN_USER) -d $(POSTGRES_ADMIN_DB)
APP_PSQL = $(COMPOSE) exec -T -e PGPASSWORD=$(DVAS_DB_PASSWORD) $(POSTGRES_SERVICE) psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U $(DVAS_DB_USER) -d $(DVAS_DB_NAME)

.PHONY: db-check-tools db-up db-wait db-drop db-create db-schema db-seed db-demo db-validate db-smoke db-reset db-acceptance
.NOTPARALLEL:

db-check-tools:
	printf "Checking DVAS P0 database acceptance tools...\n"
	missing=0; \
	if command -v docker >/dev/null 2>&1; then docker --version; else echo "ERROR: docker CLI not found."; missing=1; fi; \
	if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then docker compose version; else echo "ERROR: docker compose is not available."; missing=1; fi; \
	if command -v psql >/dev/null 2>&1; then psql --version; else echo "INFO: host psql not found; Makefile targets use psql inside the PostgreSQL service container."; fi; \
	if [ "$$missing" -ne 0 ]; then echo "ERROR: Docker with compose support is required for local PostgreSQL acceptance."; exit 127; fi

db-up: db-check-tools
	$(COMPOSE) up -d $(POSTGRES_SERVICE)

db-wait: db-up
	i=0; \
	until $(COMPOSE) exec -T -e PGPASSWORD=$(POSTGRES_ADMIN_PASSWORD) $(POSTGRES_SERVICE) pg_isready -h 127.0.0.1 -U $(POSTGRES_ADMIN_USER) -d $(POSTGRES_ADMIN_DB); do \
		i=$$((i + 1)); \
		if [ "$$i" -ge 30 ]; then echo "ERROR: PostgreSQL healthcheck did not become ready."; exit 1; fi; \
		sleep 2; \
	done

db-drop: db-wait
	$(ADMIN_PSQL) \
		-c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$(DVAS_DB_NAME)' AND pid <> pg_backend_pid();" \
		-c "DROP DATABASE IF EXISTS $(DVAS_DB_NAME);" \
		-c "DROP ROLE IF EXISTS $(DVAS_DB_USER);" \
		-c "DROP ROLE IF EXISTS dvas_readonly;"

db-create: db-wait
	$(ADMIN_PSQL) -f /work/db/dvas_p0_00_create_database.sql

db-schema: db-wait
	$(APP_PSQL) -f /work/db/dvas_p0_01_schema.sql

db-seed: db-wait
	$(APP_PSQL) -f /work/db/dvas_p0_02_seed.sql

db-demo: db-wait
	$(APP_PSQL) -f /work/db/dvas_p0_03_demo_data.sql

db-validate: db-wait
	$(APP_PSQL) -f /work/db/dvas_p0_04_validation.sql

db-smoke:
	DATABASE_URL="$(DATABASE_URL)" DVAS_POSTGRES_SERVICE="$(POSTGRES_SERVICE)" python3 scripts/db_smoke_test.py

db-reset: db-drop db-create db-schema db-seed db-demo db-validate
	printf "DVAS P0 database reset and validation completed.\n"

db-acceptance: db-reset db-smoke
	printf "DVAS P0 local PostgreSQL acceptance completed.\n"
