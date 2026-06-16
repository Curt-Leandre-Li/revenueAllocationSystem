# Compliance And Audit Boundary

## Compliance Boundary

The MVP is a generic software demonstration for data revenue allocation logic. It does not provide legal advice, medical advice, compliance certification, payment settlement, or production authorization.

Any claim beyond documented system behavior requires PM and user approval.

## Software Copyright Material Positioning

Software copyright materials may describe:

- Product name and generic purpose.
- Module boundaries.
- Deterministic computation flow.
- Input and output artifacts.
- Audit-readable reports.
- Simulated demonstration data.

They must not claim real deployment, real hospital data processing, or real settlement authority unless approved evidence exists.

## Simulated Data Boundary

- All demo data is simulated by default.
- Simulated outputs are calculation examples.
- Simulated outputs are not real business conclusions.
- Simulated examples must use `is_simulated = true` or equivalent copy in UI/report.

## Medical Case Boundary

Medical content may appear only as optional sample language for explanation. It must not define:

- Core schema.
- Pipeline architecture.
- Quality formulas.
- Utility formulas.
- DAUS or Shapley behavior.
- Contract constraints.
- Report claims.

Example data must not be written as real hospital data.

## Risk Language Boundary

Use cautious language:

- `allocation reference`
- `calculation result`
- `simulated example`
- `requires confirmation`
- `audit trace`

Avoid unsupported language:

- real settlement completed
- hospital verified
- legally compliant
- payment executed
- clinical conclusion

## Audit Record Requirements

Each report should preserve:

- Input package ID.
- Participant IDs.
- Data Unit IDs.
- Validation warnings and errors.
- Quality, metering, utility, and contribution artifacts.
- DAUS and Shapley positioning.
- Contract constraints and confirmation flags.
- Final allocation reference.
- Generated timestamp.
- Simulated-data statement.

Audit records explain the calculation path. They do not certify final legal or business decisions.
