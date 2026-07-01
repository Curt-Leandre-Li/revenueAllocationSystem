# P1 Auth / MyContent 验收门报告

日期：2026-06-26
范围：P1 登录/RBAC、我的内容、用户管理、权限拦截、数据归属、审计、前端筛选与构建验收。
结论：**PASS（P1 Auth/MyContent 闭环）**；**PARTIAL（全系统按钮真实需求巡检）**，原因见“按钮巡检”。

## 1. 本轮接口范围

| method | path | required permission | response schema | 当前用户解析 | 后端过滤 | audit_log | 测试用例 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | public | `{token,user,roles,permissions}` | username/password 校验后创建 session | 不适用 | 成功/失败写 LOGIN | `test_p1_http_business_api_requires_login_and_login_failure_is_audited` |
| POST | `/api/v1/auth/logout` | public/token optional | `{logged_out}` | `_auth_token` 找 session | 不适用 | 成功写 LOGOUT | 浏览器验收 + HTTP 审计检查 |
| GET | `/api/v1/auth/me` | authenticated | `{user,roles,permissions}` | Bearer token -> session -> user_id | 当前用户 | 失败写 AUTH_REQUIRED | `test_p1_auth_me_requires_login_and_system_users_requires_admin_permission` |
| GET | `/api/v1/my/projects` | authenticated | table page `{items,total,page,page_size}` | Bearer token | `scope=mine` 按 `created_by/operator_id`，否则按角色可见 | 失败写权限审计 | `test_p1_auth_me_and_my_content_filter_by_current_user` |
| GET | `/api/v1/my/uploads` | authenticated | table page | Bearer token | `scope=mine` 按 `data_package.created_by`，否则按角色可见 | 失败写权限审计 | `test_p1_jobs_and_reports_created_by_current_user` |
| GET | `/api/v1/my/jobs` | authenticated | table page | Bearer token | `scope=mine` 按 `requested_by/created_by`，否则按角色可见 | 失败写权限审计 | `test_p1_jobs_and_reports_created_by_current_user` |
| GET | `/api/v1/my/reports` | authenticated | table page | Bearer token | `scope=mine` 按 `report_record.created_by`，否则按角色可见 | 失败写权限审计 | `test_p1_jobs_and_reports_created_by_current_user` |
| GET | `/api/v1/my/workbench` | authenticated | `{summary,projects,uploads,jobs,reports,recent_operations}` | Bearer token | 调用同一组后端过滤函数聚合 | 失败写权限审计 | `test_p1_auth_me_and_my_content_filter_by_current_user` |
| GET | `/api/v1/system/users` | `USER-001` | table page user list | Bearer token | 系统管理员按钮权限 | 403 写 GET_SYSTEM_USER | `test_p1_role_permission_matrix_blocks_direct_api_bypass` |
| POST | `/api/v1/system/users` | `USER-002` | user object | Bearer token | 系统管理员按钮权限 | 失败写 POST_SYSTEM_USER | `test_p1_admin_user_management_actions_are_backend_writes` |
| PATCH | `/api/v1/system/users/{user_id}` | `USER-003` | user object | Bearer token | 系统管理员按钮权限 | 失败写 PATCH_SYSTEM_USER | `test_p1_admin_user_management_actions_are_backend_writes` |
| POST | `/api/v1/system/users/{user_id}/disable` | `USER-004` | user object | Bearer token | 系统管理员按钮权限 | 失败写 POST_SYSTEM_USER | `test_p1_admin_user_management_actions_are_backend_writes` |
| POST | `/api/v1/system/users/{user_id}/reset-password` | `USER-007` | user object + temporary password | Bearer token | 系统管理员按钮权限 | 失败写 POST_SYSTEM_USER | `test_p1_admin_user_management_actions_are_backend_writes` |
| GET | `/api/v1/system/roles` | `USER-008` | table page roles | Bearer token | 系统管理员按钮权限 | 失败写 GET_SYSTEM_ROLE | `test_p1_admin_user_management_actions_are_backend_writes` |
| GET | `/api/v1/system/permissions` | `USER-009` | table page permissions | Bearer token | 系统管理员按钮权限 | 失败写 GET_SYSTEM_PERMISSION | `test_p1_admin_user_management_actions_are_backend_writes` |
| PUT | `/api/v1/system/roles/{role_id}/permissions` | `USER-009` | role + permission_codes | Bearer token | 系统管理员按钮权限 | 失败写 PUT_SYSTEM_ROLE | `test_p1_admin_user_management_actions_are_backend_writes` |
| any protected HTTP | business APIs | authenticated + route button/menu where defined | standard envelope | Bearer token | 401/403 at interface layer | 401/403 写失败审计 | `test_p1_role_permission_matrix_blocks_direct_api_bypass` |

统一错误结构：`{success:false, code, message, field_errors, error, trace_id}`。

## 2. 前端入口范围

| entry | 当前状态 |
| --- | --- |
| 登录页 | 已接入真实 `/auth/login`，无注册入口，登录失败展示后端错误。 |
| 顶部用户菜单 | 显示当前用户名、角色，提供我的项目、我的上传、我的任务、我的报告、退出登录。 |
| 我的工作台 | `/dashboard` 展示当前用户可见项目、上传、任务、报告、最近操作摘要。 |
| 我的项目 | 顶部菜单进入 `/dashboard`，后端来源为 `/my/workbench`。 |
| 我的上传 | `/data/ingestion` 有“全部有权限数据包 / 我上传的”，`我上传的` 请求 `/my/uploads?scope=mine`。 |
| 我的任务 | `/allocation/md-dshap` 有“我发起的任务 / 当前项目任务 / 全部有权限任务”，`我发起的任务` 请求 `/my/jobs?scope=mine`。 |
| 我的报告 | `/reports` 有“全部有权限报告 / 我生成的报告”，`我生成的报告` 请求 `/my/reports?scope=mine`。 |
| `/system/users` | admin 可见并可操作；普通用户菜单隐藏，直接输入 URL 显示 403，后端返回 403。 |

## 3. 登录验证

| 验证项 | 结论 | 证据 |
| --- | --- | --- |
| 未登录拦截 | PASS | Playwright：访问 `/metering/utility` 显示登录页，URL 保持 `/metering/utility`。 |
| 登录后 redirect | PASS | admin 登录后回到 `/metering/utility`，不是固定跳 `/dashboard`。 |
| 登出 | PASS | 顶部菜单退出登录后清除 token，仍在受限 URL 时显示登录页。 |
| 登录态保持 | PASS | 刷新 `/metering/utility` 后仍显示业务页面。 |
| token 无效 | PASS | localStorage 写入坏 token 后刷新受限页，回登录页。 |
| 登录失败提示 | PASS | `POST /auth/login` 错误密码返回 401 `DVAS_AUTH_FAILED`。 |
| audit_log | PASS | 登录成功、登录失败、登出、403 都有 audit_log。登录失败无已认证用户，operator_id 使用 P0 兼容标识 `local_operator`；403 使用当前登录 user_id。 |

## 4. RBAC 验证

| 账号 | 结论 |
| --- | --- |
| admin | PASS：可访问 `/system/users`，拥有 `USER-001/002/003/004/007/008/009` 和系统管理入口，可创建、编辑、禁用、重置密码、查看角色与权限并更新角色权限。 |
| biz_admin | PASS：可访问数据接入、资源、参与方、收益分配、报告；`GET /system/users` 返回 403；无系统权限配置按钮。 |
| algo_reviewer | PASS：可访问质量、数元、效用、MD-DShap；不能维护合同比例方案；不能更新 MD-DShap 参数；不能访问用户管理。 |
| contract_reviewer | PASS：可访问合同分配规则和收益分配模拟；不能更新 MD-DShap 参数；不能访问用户管理。 |
| auditor | PASS：可查看审计日志并导出审计日志；上传、完整链路计算、系统参数访问均返回 403。 |
| viewer | PASS：只保留系统首页和报告查看入口；审计日志、系统参数、用户管理、上传、未授权导出均返回 403。 |

## 5. 我的内容验证

在临时 in-memory 仓储中分别用 `biz_admin` 和 `admin` 创建上传、任务和报告：

| 项目 | 结论 |
| --- | --- |
| 我的项目 | PASS：`/my/projects` 由后端按当前用户或角色可见范围返回，`scope=mine` 按 `created_by/operator_id`。 |
| 我的上传 | PASS：`/my/uploads?scope=mine` 对 `biz_admin` 只返回 `created_by=biz_admin`，对 `admin` 只返回 `created_by=admin`。 |
| 我的任务 | PASS：`/my/jobs?scope=mine` 只返回当前用户 `requested_by/created_by` 的 async_job 和 MD-DShap task。 |
| 我的报告 | PASS：`/my/reports?scope=mine` 只返回当前用户 `created_by` 的报告。 |
| 我的工作台 | PASS：`/my/workbench.summary` 与明细接口数量一致。 |
| 后端过滤证据 | PASS：直接调用后端接口也按 user_id/role/scope 过滤，不依赖前端本地数组筛选。 |

## 6. 数据归属验证

| 字段 | 结论 |
| --- | --- |
| `allocation_project.created_by` | PASS：登录态上传/初始化会使用当前登录 user_id；P0 无登录兼容仍可使用 `local_operator`。 |
| `data_package.created_by` | PASS：上传写当前登录 user_id。 |
| `async_job.requested_by/created_by` | PASS：任务写当前登录 user_id。 |
| `md_dshap_task.requested_by/created_by` | PASS：MD-DShap 任务写当前登录 user_id。 |
| `report_record.created_by` | PASS：报告导出写当前登录 user_id。 |
| `audit_log.operator_id` | PASS：登录态操作与 403 写当前登录 user_id；未登录失败无用户上下文，使用 P0 兼容标识。 |
| `local_operator` | PASS：仅保留为 P0 无登录兼容路径和未认证失败标识，不污染 P1 登录态新建业务记录。 |

## 7. 安全验证

| 项目 | 结论 |
| --- | --- |
| 无公开注册 | PASS：登录页只提示“如需账号，请联系系统管理员”；前端源码无注册入口。 |
| 无前端硬编码密码 | PASS：开发密码只存在于后端种子、后端测试和 `docs/DEV_ACCOUNTS.md`；前端源码无命中。 |
| 无明文密码存储 | PASS：localStorage 只保存 session token，不保存 password；后端返回 user 时移除 `password_hash`。 |
| 敏感日志 | PASS：失败审计会脱敏 `password/token/_auth_token`；未发现前端 `console.log` 打印密码/token/权限全量。 |
| 401/403 | PASS：无 token 业务 HTTP 返回 401；无权限返回 403；均为统一错误 envelope。 |
| DEV_ACCOUNTS.md | PASS：文件首行标注 `DEV ONLY`，未被生产构建引用。 |
| `.env` | PASS：仓库仅发现 `.env.example`，内容为开发占位连接串；未发现 `.env` 或 `.env.local`。 |

## 8. 按钮巡检

P1 Auth/MyContent 相关按钮结论：**PASS**。

- `USER-001/002/003/004/007/008/009`：真实后端接口，admin 可执行，非 admin 403。
- 顶部用户菜单：真实登录态，退出登录调用后端 logout 并清本地 token。
- `/data/ingestion`、`/allocation/md-dshap`、`/reports` 的“我的”筛选：已发后端 scope 参数，不是只做前端假筛选。
- `/system/audit` 导出：auditor/admin 可调用真实后端导出。

全系统业务按钮巡检结论：**PARTIAL**。

- 真实后端动作：数据包上传/删除、CSV/XLSX 模板、质量/数元/贡献/效用计算、MD-DShap 任务、合同比例方案、收益分配模拟、报告导出、审计导出、系统用户管理。
- 只读刷新动作：部分“查看详情/查看结果/查看轨迹”按钮通过后端刷新或打开已有数据抽屉，不产生写入。
- 明确禁用或暂未启用：资源绑定抽屉、数元参数/调用量抽屉、质量导出说明/历史版本、效用导出说明/历史版本、MD-DShap 历史任务入口等仍是非 P1 Auth/MyContent 范围内的业务能力；这些入口没有 mock/fallback 成功。

## 9. 测试命令和结果

```bash
PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest backend.tests.test_api_contract
```

结果：PASS，`Ran 99 tests in 0.645s OK`。

```bash
cd ui_prototype && npm run build
```

结果：PASS，`tsc && vite build` 成功；存在 Vite chunk size warning，不影响构建。

```bash
git diff --check
```

结果：PASS，无 whitespace error。

其他验收：

- Playwright 登录/redirect/刷新/登出/403/坏 token：PASS。
- HTTP RBAC 矩阵：PASS。
- 安全 grep：PASS，前端无开发密码，未发现公开注册入口或敏感 console 输出。

## 10. 仍需注意

- 本报告不表示所有非 P1 业务按钮都已扩展成完整生产能力；本轮按要求不扩功能，只确认 P1 登录、权限、我的内容闭环和权限拦截。
- `docs/DEV_ACCOUNTS.md` 和后端种子账号仅限 DEV ONLY，生产必须替换密码初始化流程。
- 当前工作区有大量既有脏文件，本轮未回滚、未清理无关改动。
