# P1 PDF 与历史报告管理

## PDF 生成

接口：

```text
POST /api/v1/projects/{project_id}/reports/pdf
```

前置条件：

- 已完成收益分配模拟。
- 当前用户具备 `REP-003` 按钮权限。

生成内容：

- `report_record`
- `export_file`
- `report_manifest`
- 本地 PDF 文件
- `checksum`

## 历史报告

接口：

- `GET /api/v1/projects/{project_id}/reports`
- `GET /api/v1/reports/{report_id}`
- `GET /api/v1/reports/{report_id}/files`
- `GET /api/v1/reports/{report_id}/manifest`

历史报告不会静默覆盖，重复导出会生成新的 `report_id` 和文件路径。

## 下载权限

接口：

```text
GET /api/v1/reports/{report_id}/download
```

权限：

- 需要 `REP-011` 按钮权限。

返回：

- `file_name`
- `file_format`
- `byte_size`
- `checksum`
- `checksum_verified`
- `content_base64`

## 归档

接口：

```text
PATCH /api/v1/reports/{report_id}/archive
```

归档只更新报告状态，不删除文件、不删除审计记录。

## 模拟参考边界

PDF 和历史报告均必须保留：

> 系统输出仅为模拟参考，非法律结算 / 非法定结算结果，不构成付款指令、资产评估报告或正式审计报告。
