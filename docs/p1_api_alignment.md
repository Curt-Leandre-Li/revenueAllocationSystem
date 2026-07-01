# P1 API 对齐说明

## Auth / RBAC

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | 用户名密码登录，返回 session token、用户、角色、权限摘要。 |
| POST | `/api/v1/auth/logout` | 注销当前 session。 |
| GET | `/api/v1/auth/me` | 返回当前用户、角色、菜单/按钮/API/导出权限。 |
| GET | `/api/v1/auth/permissions` | 返回当前用户权限摘要。 |

## 用户 / 角色 / 权限

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/system/users` | 用户列表。 |
| POST | `/api/v1/system/users` | 新增用户。 |
| PATCH | `/api/v1/system/users/{user_id}` | 更新用户信息和角色。 |
| POST | `/api/v1/system/users/{user_id}/disable` | 禁用用户。 |
| POST | `/api/v1/system/users/{user_id}/reset-password` | 重置密码。 |
| GET | `/api/v1/system/roles` | 角色列表和权限编码。 |
| GET | `/api/v1/system/permissions` | 权限矩阵。 |
| PUT | `/api/v1/system/roles/{role_id}/permissions` | 更新角色权限编码。 |

## 模板导入

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/import-templates/csv` | 下载 CSV 模板。 |
| GET | `/api/v1/import-templates/xlsx` | 下载 XLSX 模板。 |
| POST | `/api/v1/projects/{project_id}/data-packages/import/csv` | 上传 CSV 模板，字段名 `file`。 |
| POST | `/api/v1/projects/{project_id}/data-packages/import/xlsx` | 上传 XLSX 模板，字段名 `file`。 |

## 任务

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/projects/{project_id}/jobs` | 执行完整链路 job；要求已有已保存或锁定的合同比例方案。 |
| GET | `/api/v1/projects/{project_id}/jobs` | 查询项目 job 列表。 |
| GET | `/api/v1/jobs/{job_id}` | 查询 job 详情。 |
| POST | `/api/v1/jobs/{job_id}/cancel` | 取消未完成 job。 |
| POST | `/api/v1/projects/{project_id}/md-dshap/tasks` | 以 job 形式执行 MD-DShap。 |
| GET | `/api/v1/projects/{project_id}/md-dshap/tasks/{task_id}/progress` | 查询 MD-DShap 进度。 |

## 报告

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/projects/{project_id}/reports/pdf` | 生成 PDF 报告。 |
| GET | `/api/v1/projects/{project_id}/reports` | 历史报告列表。 |
| GET | `/api/v1/reports/{report_id}` | 报告详情。 |
| GET | `/api/v1/reports/{report_id}/files` | 报告文件列表。 |
| GET | `/api/v1/reports/{report_id}/manifest` | 报告 manifest。 |
| GET | `/api/v1/reports/{report_id}/download` | 权限控制下载报告文件。 |
| PATCH | `/api/v1/reports/{report_id}/archive` | 归档历史报告。 |

## 审计

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/audit/logs` | 审计日志列表。 |
| GET | `/api/v1/audit/logs/{log_id}` | 审计日志详情。 |
| GET | `/api/v1/audit/snapshots/{snapshot_id}` | 快照详情。 |
| POST | `/api/v1/audit/export` | 导出审计日志。 |
