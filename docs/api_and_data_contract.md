# API And Data Contract

This contract is a draft for coding. Backend work must follow it unless PM and user approve a change.

## Input JSON Draft

```json
{
  "package_id": "demo-package-001",
  "scenario": {
    "name": "Generic simulated data revenue allocation demo",
    "is_simulated": true,
    "description": "Generic sample for software copyright demonstration"
  },
  "participants": [
    {
      "participant_id": "provider_a",
      "display_name": "Provider A",
      "role": "data_provider"
    }
  ],
  "data_units": [
    {
      "data_unit_id": "du_001",
      "participant_id": "provider_a",
      "token_count": 1200,
      "quantity": 1,
      "quality_inputs": {
        "completeness": 0.95,
        "validity": 0.9,
        "consistency": 0.88,
        "traceability": 0.92
      },
      "utility_inputs": {
        "business_relevance": 0.8,
        "reuse_potential": 0.7
      }
    }
  ],
  "contract_constraints": {
    "currency": "CNY",
    "revenue_pool": 100000,
    "minimum_guarantees": {
      "provider_a": 1000
    },
    "caps": {
      "provider_a": 60000
    },
    "expert_confirmation_required": true,
    "human_confirmation_required": true,
    "manual_adjustment_note": "No manual adjustment applied in simulation."
  }
}
```

## Output JSON Draft

```json
{
  "package_id": "demo-package-001",
  "ok": true,
  "validation": {
    "errors": [],
    "warnings": []
  },
  "quality_results": [],
  "metering_results": [],
  "utility_results": [],
  "contribution_results": [],
  "allocation_reference": {
    "currency": "CNY",
    "revenue_pool": 100000,
    "participant_allocations": [],
    "confirmation_required": true
  },
  "report": {
    "report_id": "report-demo-package-001",
    "is_simulated": true,
    "sections": []
  }
}
```

The empty arrays above indicate list positions in the envelope. Their item shapes are frozen below and must be used by backend and frontend work.

QualityResult:

```json
{
  "data_unit_id": "du_001",
  "participant_id": "provider_a",
  "completeness": 0.95,
  "validity": 0.9,
  "consistency": 0.88,
  "traceability": 0.92,
  "quality_score": 0.9125,
  "warnings": []
}
```

MeteringResult:

```json
{
  "data_unit_id": "du_001",
  "participant_id": "provider_a",
  "token_count": 1200,
  "quantity": 1,
  "metered_units": 1
}
```

UtilityResult:

```json
{
  "data_unit_id": "du_001",
  "participant_id": "provider_a",
  "business_relevance": 0.8,
  "reuse_potential": 0.7,
  "utility_score": 0.75
}
```

ContributionResult:

```json
{
  "participant_id": "provider_a",
  "base_signal": 0.684375,
  "daus_score": 0.684375,
  "shapley_weight": 1.0,
  "contribution_reference": 1.0
}
```

ParticipantAllocation:

```json
{
  "participant_id": "provider_a",
  "base_amount": 100000,
  "minimum_guarantee": 1000,
  "cap": 60000,
  "constraint_adjustment": -40000,
  "final_allocation_reference": 60000,
  "confirmation_required": true,
  "warnings": [
    "cap_applied",
    "expert_confirmation_required",
    "human_confirmation_required"
  ]
}
```

## API Draft

- `POST /api/pipeline/validate`: validate an input package and return errors/warnings.
- `POST /api/pipeline/run`: run the full deterministic pipeline and return artifacts.
- `GET /api/reports/{report_id}`: return a generated report artifact if persisted in a later implementation.

For the MVP, local function calls may be implemented before HTTP endpoints. The same contract names must be preserved.

## Pipeline Input And Output

Pipeline input:

- `InputPackage`

Pipeline output:

- `ValidationResult`
- `QualityResult[]`
- `MeteringResult[]`
- `UtilityResult[]`
- `ContributionResult[]`
- `AllocationReference`
- `ReportArtifact`

## Error Structure

```json
{
  "code": "missing_required_field",
  "message": "participant_id is required",
  "path": "data_units[0].participant_id",
  "severity": "error"
}
```

Allowed severities:

- `error`
- `warning`

## Report Structure

```json
{
  "report_id": "report-demo-package-001",
  "generated_at": "2026-06-16T00:00:00+08:00",
  "is_simulated": true,
  "title": "Data Revenue Allocation Simulation Report",
  "summary": {},
  "sections": [
    {
      "section_id": "input_summary",
      "title": "Input Summary",
      "items": []
    }
  ],
  "warnings": [],
  "audit_trace": []
}
```

## Field Naming Rules

- Use snake_case for JSON fields.
- Use stable string IDs for package, participant, Data Unit, and report records.
- Use `data_unit_id`, not Effective DU terminology.
- Use `token_count` only for Token quantity when needed.
- Use `allocation_reference`, not settlement or payment wording.
- Use `is_simulated` for sample data boundary.

## Required And Optional Field Matrix

| Object | Field | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| InputPackage | `package_id` | Yes | none | Stable string. |
| Scenario | `is_simulated` | Yes | none | Must be `true` for MVP samples. |
| Participant | `participant_id` | Yes | none | Must match Data Unit references. |
| DataUnit | `data_unit_id` | Yes | none | Stable string. |
| DataUnit | `token_count` | No | `0` | Token quantity only. |
| DataUnit | `quantity` | Yes | none | Generic Data Unit quantity. |
| ContractConstraints | `revenue_pool` | Yes | none | Simulated amount for reference calculation. |
| ContractConstraints | `minimum_guarantees` | No | `{}` | Participant keyed values. |
| ContractConstraints | `caps` | No | `{}` | Participant keyed values. |
| ContractConstraints | `expert_confirmation_required` | No | `false` | Propagates to output warnings. |
| ContractConstraints | `human_confirmation_required` | No | `false` | Propagates to output warnings. |

## Example Data Boundary

- Example data must be simulated.
- Example data must not be described as real hospital data.
- Example data must not be described as verified business settlement data.
- Medical-looking examples require explicit labels that they are generic simulated examples.
