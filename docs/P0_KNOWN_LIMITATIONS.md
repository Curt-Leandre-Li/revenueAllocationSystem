# P0 Known Limitations

P0 is a local demo and software-copyright acceptance edition. It is not a production settlement or payment system.

## Product Limitations

- P0 does not implement login or production RBAC.
- P0 does not implement PDF export; PDF remains P1.
- P0 does not implement async queues.
- P0 does not implement multi-tenancy.
- P0 does not connect to real bank, tax, payment, or electronic signature systems.
- P0 does not process unmasked real sensitive raw data.
- P0 outputs are revenue allocation simulation references only and are not statutory settlement results, payment instructions, contract performance, or authority approval.

## Environment Limitations

- The local machine used for this release audit has no Docker or local `psql`; real database validation depends on GitHub Actions PostgreSQL 16 service containers.
- Local reproduction requires Docker Compose or another PostgreSQL 16 environment with `DATABASE_URL=postgresql://dvas_app:password@localhost:5432/dvas_p0`.

## Artifact Limitations

- Screenshot PNG files are delivered through GitHub Actions artifacts and are not committed to the repository.
- Existing local zip/docx/output files are not part of this Phase 2E commit unless a separate packaging step explicitly requests them.
