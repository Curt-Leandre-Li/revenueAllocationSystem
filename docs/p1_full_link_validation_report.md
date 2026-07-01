# P1 功能闭环验收报告

生成日期：2026-06-25

## 结论总览

| 模块 | 结论 | 说明 |
| --- | --- | --- |
| 登录 / RBAC | PASS | 已提供 `/auth/login`、`/auth/me`、用户、角色、权限接口，前端无 token 时进入登录页。 |
| 用户角色权限 | PASS | 后端持久化 `user_accounts`、`roles`、`permissions`、`user_roles`、`role_permissions`，前端用户页读取真实接口。 |
| CSV/XLSX 模板导入 | PASS | 后端提供模板下载和上传导入，导入后复用数据包校验、输入快照、资源和参与方生成链路。 |
| 数据校验与快照 | PASS | CSV/XLSX 导入最终进入 `DataIngestionService.import_structured_payload`，生成 `validation_result` 和 `input_snapshot`。 |
| 异步任务执行 | PARTIAL | 已有 `async_job` 状态、进度、失败追踪和取消接口；当前实现为同步执行后写 job 状态，尚未接独立队列或后台 worker。 |
| 进度查看 / 取消 / 失败追踪 | PARTIAL | job 可查询，失败会写 `error_code/failure_reason`；由于本地任务快速同步完成，取消主要覆盖未完成 job 的协议。 |
| PDF 报告生成 | PASS | PDF 由后端 `ReportService.generate_pdf()` 生成，并写入 `report_record/export_file/report_manifest/checksum`。 |
| 历史报告管理 | PASS | 支持项目报告列表、详情、文件列表、manifest、下载、归档。 |
| 权限控制下载 | PASS | 下载接口由 `REP-011` button 权限保护，文件 checksum 由后端校验返回。 |
| 审计日志追溯 | PASS | P1 登录、导出、归档、已有计算链路均写审计；提供 `/audit/logs`、`/audit/snapshots/{id}`、`/audit/export`。 |

## 验证结果

- `PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest backend.tests.test_api_contract`：PASS，90 tests。
- `cd ui_prototype && npm run build`：PASS，Vite 仅提示 chunk 大小超过 500 kB。

## 已验证闭环

1. `POST /auth/login` 获取 session token。
2. `GET /auth/me` 返回用户、角色、菜单权限、按钮权限、接口权限。
3. `GET /import-templates/csv` 返回模板文件 base64、checksum、文件大小。
4. `POST /projects/{project_id}/data-packages/import/csv` 生成数据包、校验结果、输入快照、资源、参与方。
5. `PUT /projects/{project_id}/allocation/contract-ratio` 保存合同比例方案；未保存时完整链路 job 返回标准失败。
6. `POST /projects/{project_id}/jobs` 执行完整链路并生成 job，内部复用 `DashboardService.quick_run` 和合同比例分配路径。
7. `POST /projects/{project_id}/reports/pdf` 生成 PDF 报告、manifest 和 export_file。
8. `GET /reports/{report_id}/download` 通过权限控制下载报告，并返回 checksum 校验结果。
9. `PATCH /reports/{report_id}/archive` 归档历史报告。

## 剩余风险

- async_job 目前不是后台队列实现；若需要长任务不中断页面请求，需要增加 worker 或线程队列。
- 完整链路 job 不会生成默认合同比例；调用前必须已有已保存或锁定的合同比例方案。
- PDF 使用标准库生成轻量 PDF，适合本地闭环和 checksum 验收；若要求正式中文排版，需要引入明确批准的 PDF 渲染依赖或服务。
