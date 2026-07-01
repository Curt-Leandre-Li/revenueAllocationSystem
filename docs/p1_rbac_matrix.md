# P1 RBAC 权限矩阵

## 数据对象

- `user_accounts`：用户账号、状态、密码哈希、最近登录时间。
- `roles`：角色定义。
- `permissions`：MENU / BUTTON / API / EXPORT 权限。
- `user_roles`：用户与角色关系。
- `role_permissions`：角色与权限编码关系。
- `sessions`：登录 session token。

## 默认角色

| 角色 | 说明 |
| --- | --- |
| SYSTEM_ADMIN | 拥有 P1 用户、权限、导入、计算、报告和审计能力。 |
| BUSINESS_ADMIN | 维护数据、参与方、合同规则和收益分配模拟。 |
| ALGORITHM_REVIEWER | 执行和复核质量、计量、效用和 MD-DShap 任务。 |
| CONTRACT_REVIEWER | 维护合同比例方案并复核收益分配结果。 |
| AUDITOR | 查看审计日志、快照和历史报告。 |
| VIEWER | 查看业务页面和导出结果，不执行写操作。 |

## 默认用户

| 用户名 | 角色 | 初始密码 |
| --- | --- | --- |
| admin | SYSTEM_ADMIN | admin123 |
| business_admin | BUSINESS_ADMIN | business123 |
| algorithm_reviewer | ALGORITHM_REVIEWER | algorithm123 |
| contract_reviewer | CONTRACT_REVIEWER | contract123 |
| auditor | AUDITOR | audit123 |
| viewer | VIEWER | viewer123 |

注：当前实现使用本地演示哈希策略，适合本地 P1 闭环；生产级密码策略、MFA 和账号锁定不在本轮范围。

## 权限类型

- MENU：控制菜单可见性。
- BUTTON：控制页面操作按钮。
- API：记录接口级权限范围。
- EXPORT：控制报告文件下载等导出动作。

关键按钮权限：

- `DATA-010`：下载 CSV 模板。
- `DATA-011`：下载 XLSX 模板。
- `DATA-012`：导入 CSV/XLSX。
- `MDS-019`：取消计算任务。
- `REP-003`：生成 PDF 报告。
- `REP-010`：查看历史报告。
- `REP-011`：下载报告文件。
- `REP-012`：归档历史报告。
- `USER-001` 至 `USER-009`：用户、角色和权限管理。
