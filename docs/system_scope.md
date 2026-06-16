# System Scope

## System Positioning

DVAS v2 is a generic data revenue allocation system and software-copyright product for data-element revenue allocation. It accepts structured data contribution inputs, computes auditable intermediate signals, prepares contribution and allocation references, and produces reports that explain how each result was derived.

The product is not a medical system. Medical examples may be used only as sample scenarios for demonstrations or software copyright explanation. They must not define the generic architecture, field model, scoring rules, API contract, or final allocation logic.

The system output is a calculation and audit reference. It does not replace contract terms, expert confirmation, human confirmation, or legal/business settlement decisions.

## Target Users

- Product owner: defines MVP scope, scenario boundaries, and delivery priorities.
- Data operations user: prepares input records and reviews validation feedback.
- Business analyst: reviews contribution, quality, utility, and allocation references.
- Auditor or reviewer: checks traceability, assumptions, simulated examples, and report consistency.
- Developer or agent: implements approved modules after this freeze package is accepted.

## MVP Boundary

The MVP includes:

- Generic input records and participant metadata.
- Validation of required fields, naming, and numeric ranges.
- Quality assessment for completeness, validity, consistency, and traceability.
- Data Unit metering for approved generic units.
- Utility modeling using deterministic and documented formulas.
- DAUS / Shapley contribution calculation as a computation-layer weight reference.
- Contract constraint application for minimum guarantee, cap, and manual/expert confirmation flags.
- Final allocation reference output after approved constraints are applied.
- Audit report generation with inputs, intermediate signals, assumptions, warnings, and result summaries.
- Lightweight demonstration UI after schema and API contracts are frozen.

## Non-Goals

The MVP does not include:

- Real hospital integration or any real hospital data claim.
- Medical, clinical, laboratory, policy, insurance, or disease-specific architecture.
- Marketplace settlement, payment processing, invoicing, or live clearing.
- External data source synchronization.
- User authentication, authorization, tenant isolation, or production security workflow.
- Model training, adaptive scoring, or hidden random behavior.
- Legal advice or compliance certification.
- Restoring MAR.
- Restoring Effective DU.
- Restoring `token_weighting` as a main-process term.
- Treating Shapley output as the final revenue allocation layer.

## Core Business Chain

The frozen MVP chain is:

```text
input package
-> validation
-> quality assessment
-> Data Unit metering
-> utility modeling
-> DAUS / Shapley contribution reference
-> contract constraint application
-> final allocation reference
-> audit report
```

Every implementation task must map to this chain. A proposed module outside this chain requires PM Strategy review and explicit user approval before coding.

## Terminology Freeze

Top-level terms are frozen as:

- Token: a minimal countable text or data-processing unit used only when the approved input contract needs token-level quantity.
- Data Unit: the business-facing generic data unit used for contribution, quality, utility, and allocation reference calculations.

Rules:

- Use `Data Unit`, not `DU`, in user-facing docs unless the abbreviation is defined locally.
- Do not introduce Effective DU.
- Do not use `token_weighting` as a main-process term.
- DAUS is a utility/contribution signal layer, not a final settlement layer.
- Shapley is a computation-layer weight determination method, not final revenue allocation.
- Final allocation reference may be adjusted by contract terms, minimum guarantee, cap, expert confirmation, and human confirmation.

## Delivery Boundary

The pre-coding freeze package delivers documentation only:

- Product scope and milestone plan.
- Product requirements.
- Architecture and module boundaries.
- Allocation logic design.
- UI flow and component split guidance.
- API and data contract draft.
- Test plan and validation commands.
- Compliance and audit boundary.
- Development task breakdown.
- Pre-coding freeze checklist.

No product code, frontend implementation, backend implementation, algorithm implementation, dependency installation, commit push, merge, or deployment is included in the freeze package.

## Today Freeze Conclusion

As of 2026-06-16, the product may proceed to coding only after this freeze package is committed and the checklist in `docs/pre_coding_freeze_checklist.md` remains green.

The scope is frozen for MVP coding:

- Build a generic data revenue allocation demo product.
- Keep medical content as optional sample data only.
- Keep Shapley and DAUS below the final allocation layer.
- Preserve contract and manual confirmation as final allocation constraints.
- Use simulated data only and label it as simulated.
- Do not add dependencies until a coding task explicitly requires and receives approval.
