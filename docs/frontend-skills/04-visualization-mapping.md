# 数据可视化 Skill

## 适用场景

当 DVAS 前端需要图表、指标卡、流程图、排行、热力表或审计时间线时使用本 skill。目标是在满足“要有数据可视化”的同时，严格避免前端重新推导业务值。

## 硬规则

- 所有图表只消费后端结果字段或后端 chart DTO。
- 前端不计算质量分、数元金额、贡献度、效用值、权重、收益分配金额或合同比例方案金额。
- 前端可以做展示格式化、图例映射、颜色映射、筛选、排序、tooltip 和空值占位。
- 缺少图表所需结构时，新增后端展示 DTO 任务；不要在浏览器端拼业务计算。
- 图表旁必须保留数据来源、结果版本或快照引用。
- 涉及收益、权重、报告的图表必须展示“模拟参考，非法律结算 / 非法定结算结果”。

## 推荐 chart DTO 字段

```json
{
  "chart_id": "quality_dimension_scores",
  "chart_type": "bar",
  "title": "7 个一级质量指标得分",
  "source": {
    "result_id": "assessment_xxx",
    "snapshot_id": "snapshot_xxx",
    "generated_at": "2026-06-23T10:00:00+08:00"
  },
  "series": [],
  "metadata": {
    "precision": 2,
    "unit": "score",
    "disclaimer": "系统结果仅为模拟参考，非法律结算 / 非法定结算结果"
  }
}
```

## 页面图表映射

| 页面 | 图表 / 可视化 | 数据来源要求 |
| --- | --- | --- |
| 系统首页 | 流程进度图、项目状态卡、最近报告卡、风险提示卡、一键计算管线 | `GET /dashboard` 或 dashboard chart DTO |
| 数据接入管理 | 数据包状态分布、上传校验结果、字段/模态摘要 | data package / validation DTO |
| 数据资源管理 | 资源模态分布、字段缺失率条形图、资源与主体关系视图 | resource list/detail DTO |
| 参与方管理 | 主体类型分布、是否进入 MD-DShap 标记、参与方贡献结果摘要 | party DTO + 后端贡献摘要 DTO |
| 质量评估管理 | 质量总分卡、7 个一级指标柱状图或雷达图、17 个二级指标得分表 | quality assessment/detail DTO |
| 数元计量管理 | 资源级/参与方级数元金额柱状图、调用量趋势或排行 | shuyuan metering/detail DTO |
| 贡献度与效用计算 | 贡献度排行、效用值排行、trace 摘要 | contribution/utility/trace DTO |
| MD-DShap 计算管理 | 参与方权重条形图、边际贡献热力表、算法复杂度说明卡 | md_dshap result/marginal_trace/audit DTO |
| 合同分配规则 | 总收益、数据源主体收益池比例、非数据主体比例项、比例合计和可模拟状态 | contract_ratio plan/items DTO |
| 收益分配模拟 | 总收益到合同比例方案、数据源收益池、参与方最终分配的流向图；金额来源和尾差说明 | allocation result + contract_ratio DTO |
| 报告生成与导出 | 导出文件清单、report_id、checksum、生成时间 | report/export DTO |
| 审计日志管理 | 操作时间线、模块筛选、快照详情 | audit log/detail DTO |

## 图表组件选择

- 流程进度：横向步骤条或紧凑流程图。
- 状态分布：小型柱状图或环形图。
- 缺失率、权重、金额对比：柱状图。
- 一级质量指标：柱状图优先，雷达图只在 7 个一级指标都由后端 DTO 返回时使用。
- 收益流向：Sankey 或分段流向图；没有后端流向 DTO 时先用表格。
- 边际贡献：表格优先，热力图只展示后端给出的矩阵。
- 审计记录：时间线 + 表格筛选。

## 可视化文案规则

- 标题写业务含义，不写技术实现。
- 副标题写来源版本、时间或快照引用。
- tooltip 可解释字段含义，但不得加入前端计算结果。
- 空图表必须解释缺少哪一步结果，并给出下一步入口。

## 自检清单

- 图表数据是否完全来自后端结果或 chart DTO。
- 图表是否带有来源结果、快照或生成时间。
- 权重是否显示 6 位，金额是否显示 2 位。
- 收益/报告/确认相关图表是否显示模拟参考边界。
- 后端无数据时是否没有前端拼接替代值。
