# Pre-Coding Freeze Checklist

## Items Required Before Coding

- System scope states what the MVP does and does not do.
- Milestone plan defines Phase 0 through Phase 5 with inputs, outputs, and acceptance criteria.
- Product requirements define roles, scenarios, features, inputs, outputs, pages, reports, acceptance criteria, and non-functional requirements.
- Architecture defines modules, data flow, pipeline, contracts, responsibility boundaries, and suggested coding directories.
- Allocation logic defines quality, Data Unit metering, utility, DAUS, Shapley, contract constraints, and final allocation reference.
- UI flow defines pages, navigation, information structure, states, demo path, and component split.
- API/data contract defines input JSON, output JSON, API draft, pipeline artifacts, error structure, report structure, naming rules, and example data boundary.
- Test plan defines unit, integration, contract, UI, report, regression, and validation commands.
- Compliance and audit boundary defines simulated data, medical case limits, software copyright wording, risk language, and audit records.
- Development task breakdown can be assigned to backend, frontend, QA, docs, compliance, and DevOps agents.

## Frozen Items

- Product is a generic data revenue allocation system and data-element revenue allocation software-copyright product.
- Medical content is sample-only and cannot define generic architecture.
- Top-level terms are Token and Data Unit.
- Effective DU is not part of the MVP.
- `token_weighting` is not a main-process term.
- MAR is not restored.
- Shapley is a computation-layer weight method, not final allocation.
- DAUS is an intermediate utility/contribution signal, not final allocation.
- Final allocation reference may be affected by contract terms, minimum guarantee, cap, expert confirmation, and human confirmation.
- Simulated data must be labeled as simulated.
- Example data must not be described as real hospital data.
- Product code, frontend code, backend code, algorithm code, dependencies, deployment, push, and merge are outside Phase 0.

## Formal R&D Deliverables Check

- `docs/deliverables/00_研发产出物清单.md`: 已完成。
- `docs/deliverables/01_需求规格说明书.md`: 已完成。
- `docs/deliverables/02_系统详细设计_功能设计.md`: 已完成。
- `docs/deliverables/03_数据库设计.md`: 已完成，当前 MVP 不依赖真实数据库。
- `docs/deliverables/04_UI设计方案.md`: 已完成。
- `docs/deliverables/05_系统测试方案.md`: 已完成。
- `docs/deliverables/06_系统测试报告.md`: Phase 0 基线模板已完成，正式测试结果待编码后补充。
- `docs/deliverables/07_管理员手册.md`: 已完成，运行命令待编码后按真实实现补充。

## Unfrozen Items

- Exact formula coefficients for quality, utility, DAUS, and Shapley are not frozen.
- Exact Python package structure is suggested but not created.
- Exact frontend framework and component implementation are not frozen.
- Exact persistence model is not frozen.
- Authentication, authorization, and deployment are not in MVP scope.
- Production dependency choices are not frozen and require explicit approval.

## Risk Items

- If backend starts before API/data contract review, field drift is likely.
- If frontend starts before output artifacts exist, UI may invent schema.
- If Shapley wording is loose, reviewers may confuse contribution weights with final allocation.
- If simulated data labels are omitted, reports may look like real business conclusions.
- If medical examples are overused, they may pollute the generic system architecture.
- If tests are delayed, deterministic formula drift may be hard to detect.

## Tomorrow Coding Start Conditions

Coding may start when:

- This freeze package is committed.
- `git diff --check` passes.
- The requested docs exist under `docs/`.
- Product code remains unchanged during freeze.
- The first coding task names its assigned agent, files, inputs, outputs, validation command, and stop conditions.
- Any new dependency request is separately approved.

## Coding Entry Conclusion

Allowed to enter coding after this document package is committed and validation passes.

Recommended first coding task: backend contract and validation skeleton, using `docs/api_and_data_contract.md`, `docs/system_architecture.md`, and `docs/test_plan.md` as inputs.
