# UI Flow

## Page List

- Input Package
- Validation Results
- Pipeline Review
- Signal Details
- Contribution And Allocation
- Audit Report
- Export

## Page Navigation

```text
Input Package
-> Validation Results
-> Pipeline Review
-> Signal Details
-> Contribution And Allocation
-> Audit Report
-> Export
```

Validation errors stop the flow at Validation Results until the input is corrected.

## Page Information Structure

Input Package:

- Scenario name.
- Simulated-data label.
- Participant list.
- Data Unit list.
- Contract constraints.

Validation Results:

- Pass/fail status.
- Errors grouped by field path.
- Warnings grouped by risk type.

Pipeline Review:

- Step status for validation, quality, metering, utility, contribution, allocation, and reporting.
- Artifact links or expandable summaries.

Signal Details:

- Quality signal table.
- Data Unit metering table.
- Utility signal table.
- DAUS / Shapley contribution reference table.

Contribution And Allocation:

- Participant contribution references.
- Contract constraint adjustments.
- Final allocation reference.
- Confirmation-required warnings.

Audit Report:

- Report summary.
- Assumptions.
- Formula and constraint notes.
- Trace appendix.

Export:

- JSON export entry point.
- Report export entry point.
- Copyable summary text.

## Key Components

- `WorkflowShell`
- `InputPackageEditor`
- `ValidationSummary`
- `PipelineStepList`
- `SignalTable`
- `ContributionReferenceTable`
- `AllocationReferencePanel`
- `ConstraintWarningPanel`
- `AuditReportView`
- `ExportActions`

These are component split suggestions, not existing implementation claims.

## State Design

- Empty: no input package loaded.
- Draft: input is being edited.
- Invalid: validation errors exist.
- Ready: validation passes and pipeline can run.
- Running: pipeline is calculating.
- Complete: report artifact is available.
- Warning: output exists with confirmation-required warnings.
- Failed: unexpected pipeline error occurred.

## Demo Path

1. Load a simulated generic sample.
2. Review validation success.
3. Run pipeline.
4. Inspect quality, utility, and contribution signals.
5. Review contract constraints and final allocation reference.
6. Open audit report.
7. Export JSON or report artifact.

## Frontend Component Split Guidance

- Frontend must use fields from `docs/api_and_data_contract.md`.
- Frontend must not calculate independent allocation math.
- Frontend must show Shapley as contribution reference only.
- Frontend must label all sample outputs as simulated.
- Missing fields must be reported as API contract questions, not invented in UI.
