# P1 导入模板规格

## 传输协议

- 上传方式：`multipart/form-data`
- 文件字段名：`file`
- 模板下载：后端返回 `file_name`、`mime_type`、`byte_size`、`checksum`、`content_base64`

## CSV 模板

CSV 使用单表多记录类型结构：

| 字段 | 说明 |
| --- | --- |
| record_type | `participant`、`data_unit`、`revenue_pool`。 |
| package_name | 数据包名称。 |
| party_id | 上传包内参与方 ID。 |
| party_name | 参与方名称。 |
| party_type | `DATA_PROVIDER`、`OPERATOR`、`TECH_SERVICE` 等。 |
| is_data_provider | 数据源主体为 `true`。 |
| include_in_md_dshap | 进入 MD-DShap 权重池为 `true`。 |
| resource_name | 数据资源名称。 |
| provider_party_name | 数据源主体名称。 |
| modality | 建议使用结构化数据 / 文本数据 / 影像数据等展示值。 |
| field_count | 字段数量。 |
| sample_count | 样本数量。 |
| missing_rate | 缺失率。 |
| revenue_pool | 总收益。 |

## XLSX 模板

XLSX 包含以下工作表：

- `participants`
- `data_units`
- `revenue_pool`
- `resource_party_relation`
- `optional_constraints`

当前导入实现读取 `participants`、`data_units`、`revenue_pool`，其余工作表保留为模板兼容和后续扩展字段。

## 导入后处理

CSV/XLSX 导入后会转换为现有 JSON 上传语义：

```text
模板文件 -> 结构化 payload -> 数据包校验 -> input_snapshot -> data_resources / parties
```

不允许前端绕过后端校验，也不允许前端直接写入资源或参与方。
