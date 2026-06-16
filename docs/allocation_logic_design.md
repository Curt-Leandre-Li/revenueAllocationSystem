# Allocation Logic Design

## Contribution Metering Logic

Contribution metering starts from approved Data Unit records. Each record belongs to one participant and carries generic attributes such as quantity, completeness, validity, consistency, traceability, and declared business relevance.

The metering layer must produce intermediate measurements only. It must not produce final allocation amounts.

## Quality Assessment Logic

Quality assessment uses deterministic signals:

- Completeness: required fields and expected values are present.
- Validity: values are within approved ranges and formats.
- Consistency: related fields do not conflict.
- Traceability: source labels, participant IDs, and Data Unit IDs are reviewable.

Quality output is a signal used by utility and contribution layers. It is not a compliance certification.

## Utility Modeling Logic

Utility modeling converts approved metering and quality signals into utility scores. The MVP may use simple weighted deterministic formulas after they are documented in code and tests.

Utility must remain generic. It must not embed medical, clinical, or hospital-specific assumptions.

## DAUS Positioning

DAUS is an intermediate utility or contribution signal used to describe the value contribution of approved Data Units. It supports comparison and attribution before allocation constraints.

DAUS is not the final revenue allocation layer.

## Shapley Positioning

Shapley is a computation-layer method for determining contribution weights. It can help allocate contribution among participants or Data Units within the approved model.

Shapley output is not final revenue allocation. It must be passed to the allocation layer as a reference weight or contribution signal.

## Contract Constraint Positioning

Contract constraints are applied after contribution references are calculated. The MVP recognizes:

- Minimum guarantee.
- Cap.
- Expert confirmation required.
- Human confirmation required.
- Manual adjustment note.

Constraints must be visible in output and report artifacts.

## Final Allocation Reference

The final allocation reference is the system's calculated allocation output after approved constraints. It is still a reference for review and demonstration, not an automatic payment or legal settlement.

The output must show:

- Base contribution weight.
- Constraint adjustments.
- Final allocation reference.
- Warnings and confirmation requirements.

## Concepts That Must Not Be Confused

- Data Unit is not Effective DU.
- Token is not the same as Data Unit.
- DAUS is not final allocation.
- Shapley is not final allocation.
- Quality score is not contribution share.
- Utility score is not payment amount.
- Simulated output is not real business conclusion.
- Example data is not real hospital data.
- Contract constraint application is not payment processing.
- `token_weighting` is not a main-process term.
