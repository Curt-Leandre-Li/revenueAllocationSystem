# Stage Contract Code Audit

This audit反查 current backend and frontend code against
`docs/stage_io_contract.md`.

## Checked Areas

- Backend routing: `backend/dvas/app.py`
- Backend contracts and errors: `backend/dvas/contracts.py`
- Backend stage services: `backend/dvas/services.py`
- Backend repository/state model: `backend/dvas/repository.py`
- Frontend API endpoints and DTO access: `ui_prototype/src/domain/api/*.ts`
- Frontend backend workspace mapping: `ui_prototype/src/domain/services/backendWorkspace.ts`
- Frontend allocation context/pages: `ui_prototype/src/pages/allocation/*.tsx`

## Logic Breakpoints

### BP-001 Resource Quality Factor Stops Before Shuyuan Metering

Contract:

- Quality assessment outputs `resource_quality_assessments[]` with
  `resource_quality_factor`.
- Shuyuan metering must prefer each resource's quality factor, using package
  `quality_factor` only as fallback.

Current code evidence:

- `QualityAssessmentService` outputs resource-level `quality_factor`.
- `ShuyuanMeteringService.run` sets one package-level `quality_coefficient` from
  `quality["quality_factor"]`.
- `ShuyuanMeteringService._details` writes the same `quality_coefficient` to
  every resource detail and only splits one package-level amount by sample count.

Observed runtime shape:

```text
quality package factor 0.8846
resource factors [('resource_000001', 0.8939), ('resource_000002', 0.8844)]
shuyuan detail factors [('resource_000001', 0.8846, 480.62), ('resource_000002', 0.8846, 480.61)]
```

Impact:

- Resource-level quality output exists but is not consumed by the next stage.
- Later contribution, utility, MD-DShap, allocation, and reports lose resource
  quality provenance.

Fix boundary:

- Backend only: compute shuyuan detail amount per resource using the resource's
  own quality factor when present.
- Keep package quality factor as explicit fallback.

Fix status:

- Fixed in `ShuyuanMeteringService`: resource details now use
  `resource_quality_factor` when available and expose `quality_factor_source`.

### BP-002 Party Utility Uses One Package Quality Factor

Contract:

- Utility should consume quality provenance from resource/party aggregation when
  available.

Current code evidence:

- `UtilityService.run` sets a single `quality_factor` from
  `quality["quality_factor"]`.
- `UtilityService._trace` applies that same factor to every party.

Observed runtime shape:

```text
utility trace factors [('party_000001', 0.8846, 0.4423), ('party_000002', 0.8846, 0.4423)]
```

Impact:

- Even after shuyuan metering has resource-level detail rows, utility does not
  preserve party-level quality differences unless manually overridden.

Fix boundary:

- Backend only: derive party-level quality factor from latest shuyuan details,
  weighted by `valid_units` or `metering_amount`, and use package quality factor
  as fallback.
- Include factor source/provenance in utility trace rows.

Fix status:

- Fixed in `UtilityService`: utility trace now uses party-level weighted quality
  factors from shuyuan details and exposes `quality_factor_source`.

### BP-003 Frontend Recomputes Data-Provider Revenue Pool As Fallback

Contract:

- Frontend displays backend-calculated allocation fields. It must not compute
  allocation pool amounts when backend fields are absent.

Current code evidence:

- `backendWorkspace.buildSimulationPage` falls back to
  `totalRevenueNumber - priorityAmountNumber` when
  `data_provider_revenue_pool` is missing.
- `useAllocationContext` also falls back to
  `totalRevenue - priorityTotalAmount`.

Impact:

- A missing backend `data_provider_revenue_pool` can still appear as a valid
  number on the page, hiding an API/DTO gap.

Fix boundary:

- Frontend only: display unavailable/missing state when backend does not return
  `data_provider_revenue_pool`.
- Keep UI readiness checks, but do not present locally derived pool as backend
  result.

Fix status:

- Fixed in `backendWorkspace` and `allocationContext`: the frontend no longer
  calculates `data_provider_revenue_pool` from total revenue and priority amount
  when the backend field is absent.

### BP-004 Saved Shuyuan Call Counts Were Not Consumed

Contract:

- `DU-003` saves resource-level call counts.
- `DU-009` must use those call counts when generating shuyuan detail rows.

Current code evidence:

- Frontend service calls `PUT /metering/shuyuan/call-counts`.
- `DraftConfigurationService` persists `SHUYUAN_CALL_COUNTS`.
- `ShuyuanMeteringService.run` previously ignored that draft and used
  `sample_count` or a single package-level `call_count`.

Impact:

- User-entered resource call counts could be saved but not reflected in
  calculation output.

Fix status:

- Fixed in `ShuyuanMeteringService`: latest `SHUYUAN_CALL_COUNTS` draft is used
  for per-resource `call_count`; explicit `call_counts` payload and legacy
  package-level `call_count` are also handled.

## Non-Breakpoints Confirmed

- Backend routes expose the current P0 stage endpoints for quality, shuyuan,
  contribution, utility, MD-DShap, allocation, report, and audit.
- MD-DShap participant pool excludes non-data parties and validates normalized
  weight sum before allocation.
- Allocation simulation uses backend MD-DShap weights and backend
  `data_provider_revenue_pool`, then returns `contract_priority_allocations`,
  `data_provider_allocations`, and constraint traces.
- Frontend service action handlers call backend mutation APIs or display
  unavailable state; the main remaining calculation leak is allocation-pool
  fallback display.

## Validation Targets

After fixes:

1. Run backend API contract tests.
2. Run frontend build.
3. Run authenticated backend HTTP interface sequence and verify:
   - resource quality factors differ when resource scores differ;
   - shuyuan details use resource-level quality factors;
   - saved shuyuan call counts feed shuyuan detail rows;
   - utility trace party quality factors reflect shuyuan detail aggregation;
   - MD-DShap weights still normalize to 1;
   - allocation totals still reconcile to `data_provider_revenue_pool`.
4. Run git hygiene checks:
   - `git diff --check`
   - `git status --short`
   - `git diff --stat`
