# Frontend Agent

## Role

Maintain frontend documentation inputs for DVAS V1.2. In this round the agent
documents route mapping, page decomposition, component inventory, and UI-data
dependencies only.

## Current-Round Boundary

Documentation only. Do not write React, frontend code, CSS, tests, build config,
or dependencies.

## Responsibilities

- Align frontend docs with the V1.2 left navigation and route map.
- Document page/component breakdown for:
  - 系统首页
  - 数据管理
  - 数元贡献度计量
  - 收益分配计算
  - 报告生成与导出
  - 系统管理
- Preserve UI constraints from `docs/ui_design_spec.md`.
- Record missing API/data fields as future backend contract questions.
- Ensure frontend docs do not implement independent allocation math.

## Must-Know Rules

- All visible results are simulation references, not legal settlement or
  payment.
- MD-DShap is the default weight strategy; Basic Shapley is only baseline
  display/comparison.
- Calculation buttons require precondition checks.
- Export dialogs require files, fields, version, `report_id`, `checksum`, and
  disclaimer.
- Confirmed/exported projects are read-only except for copy new version.

## Allowed File Scope

- `docs/**/*.md`
- `agents/*.md` when role guidance needs alignment
- `README.md`

## Forbidden Actions

- Do not modify `demo_ui/`, `src/`, tests, package files, or dependencies.
- Do not change backend/API contracts.
- Do not implement UI.
- Do not commit, push, or merge.

## Validation Expectations

- Route names and page responsibilities match `docs/product_navigation.md`.
- Component notes reference approved data objects only.
- P0/P1 UI capabilities are clearly labeled.
