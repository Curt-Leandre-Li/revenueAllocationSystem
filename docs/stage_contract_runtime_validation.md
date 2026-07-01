# Stage Contract Runtime Validation

Historical snapshot: this validation covered an older contract-priority runtime
stage. Current product documentation uses the saved contract-ratio path; see
`docs/stage_io_contract.md` and `docs/CODE_DOCUMENT_DRIFT_AUDIT.md`.

## Validation Conclusion

Stage Contract Runtime Validation: **PASS**

This conclusion only covers the contract-priority and allocation-runtime stage
validated here. It does **not** declare the whole P0/P1 chain passed.

Validated scenario:

- `total_revenue`: `1,200,000.00`
- Contract-priority ratio: `0.10`
- Contract-priority amount: `120,000.00`
- Data-provider revenue pool: `1,080,000.00`
- Data-provider parties in MD-DShap: `6`
- Non-data parties in final allocation results: `2`
- MD-DShap normalized weight sum: `1.000000`
- Final result rows: `8`

## BP-001 To BP-004 Regression

The previous Stage Contract Code Audit breakpoints were kept under backend
contract-test coverage while this runtime scenario was exercised:

- BP-001: resource-level quality factors continue into shuyuan metering.
- BP-002: utility traces consume party/resource quality provenance.
- BP-003: frontend displays backend allocation-pool fields instead of
  recomputing missing backend values.
- BP-004: saved shuyuan call-count drafts are consumed by shuyuan metering.

Validation command:

```bash
PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest backend.tests.test_api_contract
```

Result: `OK` (`110` tests).

## Contract Priority Save Validation

Request payload used by the authenticated HTTP runtime scenario:

```json
{
  "party_id": "party_000007",
  "constraint_name": "10% 合同优先",
  "constraint_type": "PRIORITY_ALLOCATION",
  "value_type": "RATIO",
  "constraint_value": 0.1,
  "priority": 1
}
```

Backend response kept the value as a ratio, not as zero amount:

- `constraint_type`: `PRIORITY_ALLOCATION`
- `value_type`: `RATIO`
- `constraint_value`: `0.1`
- `party_name`: `京算医疗大模型科技有限公司`
- `status`: `ACTIVE`

Repository/state evidence:

- Active priority item state record exists with `priority_ratio=0.1`,
  `priority_amount=null`, `source_constraint_id=constraint_000001`.
- Applied allocation priority item exists with `actual_priority_amount=120000.0`
  and `allocation_id=allocation_000001`.

Constraint summary response:

- `constraint_count`: `1`
- `active_constraint_count`: `1`
- `priority_items_count`: `1`
- `ordinary_constraint_count`: `0`

## Allocation Simulation Validation

The authenticated runtime scenario produced:

- `priority_allocation_amount`: `120000.0`
- `data_provider_revenue_pool`: `1080000.0`
- `weight_sum`: `1.0`
- `data_provider_count`: `6`
- `non_data_party_count`: `2`
- `final_result_count`: `8`

MD-DShap participant rule:

- Data-provider rows enter the MD-DShap participant set.
- Non-data rows are excluded from MD-DShap and appear in the final result set
  with `amount_source=CONTRACT_PRIORITY`.
- The configured non-data party receives `120,000.00`.
- The unconfigured non-data party appears with `0.00`, preserving the final
  result contract and audit visibility.

## Amount Closure Validation

Runtime checks:

- Sum of data-provider pre-constraint amounts: `1,080,000.00`
- Sum of data-provider post-constraint amounts: `1,080,000.00`
- Sum of all final amounts: `1,200,000.00`
- `rounding_delta`: `0.0`

The validated rounding delta is within the required `<= 0.01` boundary.

## Frontend Runtime Validation

Screenshots were captured against a running backend and Vite frontend after
logging in with the local development account.

- Constraints page:
  `docs/runtime_validation/stage_contract_constraints.png`
- Simulation page:
  `docs/runtime_validation/stage_contract_simulation.png`

DOM/screenshot evidence confirms:

- Constraints page shows `10% 合同优先`, `优先分配项 1`, and `非数据主体 2`.
- Simulation page shows `总收益 1,200,000 元`,
  `非数据合同优先 120,000 元`, and `数据源收益池 1,080,000 元`.
- Simulation page shows `权重合计 1.000000` and `数据源主体 6 个`.
- Simulation page separates `优先分配项 1` from `生效普通约束 0`.
- Flow display includes total revenue, contract priority, data-provider pool,
  MD-DShap allocation, ordinary-constraint adjustment, and final results.
- Result table contains both non-data parties and all six data-provider rows.

## Export Validation

Generated export evidence:

- Markdown report: `allocation_summary.md`
- JSON report: `allocation_result.json`
- CSV files include:
  - `source_level_allocation.csv`
  - `allocation_result.csv`
  - `quality_assessment_summary.csv`
  - `shuyuan_metering_detail.csv`
  - `md_dshap_weights.csv`

JSON report required fields were present:

- `total_revenue`
- `priority_allocation`
- `priority_allocation_amount`
- `data_provider_revenue_pool`
- `weight_source`
- `results`
- `constraints`
- `rounding_note`
- `disclaimer`

CSV allocation output included `8` result rows with these contract fields:

- `party_type`
- `is_data_provider`
- `raw_weight`
- `normalized_weight`
- `pre_constraint_amount`
- `post_constraint_amount`
- `final_amount`
- `amount_source`
- `constraint_adjustment_reason`

Markdown report contained the required terms:

- `合同优先`
- `数据源收益池`
- `MD-DShap`
- `普通合同约束`
- `模拟参考`
- `非法律结算`

## Validation Commands

Commands run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3.12 -m py_compile backend/dvas/repository.py backend/dvas/services.py backend/dvas/app.py
PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest backend.tests.test_api_contract
cd ui_prototype && npm run build
```

Additional runtime validation:

- Isolated backend server on `http://127.0.0.1:18080/api/v1`
- Vite frontend on `http://127.0.0.1:5174`
- Authenticated HTTP scenario using the backend API
- Playwright screenshot and DOM capture of constraints and simulation pages

## Remaining Boundary

This document validates the contract-priority runtime stage. The following are
outside this conclusion:

- Whole P0/P1 business-chain acceptance.
- Production database acceptance.
- PDF export acceptance.
- RBAC completeness beyond the authenticated local runtime scenario.
