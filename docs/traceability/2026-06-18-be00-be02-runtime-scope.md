# BE-00/BE-01/BE-02 Runtime Scope Traceability

## Approval

On 2026-06-18, the user explicitly approved runtime implementation for:

- BE-00 工程骨架、统一响应体、错误码、DTO、OpenAPI/mock、基础 service/repository 分层。
- BE-01 项目与首页状态聚合、dashboard overview/preconditions/available_actions、一键计算入口的后端骨架。
- BE-02 数据接入管理：演示数据初始化、JSON 上传校验、输入快照、上传失败详情、数据包列表/详情。

This approval supersedes the older documentation-only freeze only for BE-00,
BE-01, and BE-02. Other runtime implementation remains outside the current
scope unless separately approved.

## Hard Boundaries

- Do not implement P1 login/RBAC.
- Do not implement PDF export.
- Do not implement async queue behavior.
- Do not implement production multi-tenant features.
- Do not implement external payment, legal settlement, tax, bank, or electronic
  signature features.
- Keep MD-DShap as a weight-layer output only; this slice does not implement
  MD-DShap runtime behavior.
- Preserve simulation-reference and non-legal-settlement boundaries in
  response data intended for UI display.

## Source Alignment

The runtime names in this slice are aligned to the current source documents:

- Project statuses:
  `DRAFT`, `INGESTED`, `ASSESSED`, `METERED`, `UTILITY_CALCULATED`,
  `WEIGHT_CALCULATED`, `ALLOCATED`, `CONFIRMED`, `EXPORTED`.
- Module/menu codes used in this slice:
  `SYS`, `DATA`, `RES`, `PARTY`, `NAV_SYS_HOME`, `NAV_DATA_PACKAGE`,
  `NAV_DATA_RESOURCE`, `NAV_DATA_PARTY`.
- P0 operator identity: `local_operator`.
- API prefix: `/api/v1`.

No runtime divergence from the approved source-document terminology is planned
for BE-00/BE-01/BE-02.
