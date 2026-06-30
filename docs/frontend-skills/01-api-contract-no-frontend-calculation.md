# 接口对齐与禁止前端计算 Skill

## 适用场景

当前端页面、图表、表格、按钮或状态展示需要接入 DVAS 后端能力时使用本 skill。它优先约束 `ui_prototype` 或任何后续前端重建工作，目标是让前端只承担展示、交互、接口调用、状态提示和格式化，不在浏览器端补写业务计算。

## 权威边界

- 以后端 HTTP API 或本地服务函数返回的数据为准。
- P0 可以不提供完整 REST API，但内部服务也必须按相同边界拆分。
- UI 不直接调用算法细节，不绕过 `QualityService`、`ShuyuanService`、`UtilityService`、`MDDShapService`、`AllocationService`、`ConstraintService`。
- MD-DShap 只产生权重层结果，不形成付款指令或最终法律分配。
- 首页只读取后端聚合状态，不重复计算业务结果。

## 前端允许做的事

- 调用后端接口或统一 adapter。
- 渲染后端字段、列表、详情、trace、快照、错误信封和 chart DTO。
- 格式化金额、百分比、日期、权重小数位、空值占位。
- 做枚举到中文标签的展示映射，例如状态标签、模块名、错误类型。
- 做 UI 层交互状态，例如展开抽屉、切换筛选、分页、排序、选中行。
- 根据后端返回的 `available_actions`、`disabled_actions`、`preconditions` 显示按钮启用或禁用。

## 前端禁止做的事

- 不计算质量总分、质量等级、维度得分或质量因子。
- 不计算数元金额、资源级金额、参与方级金额或项目级金额。
- 不计算贡献度、归一化贡献、效用值或 `v(S,t)`。
- 不执行 MD-DShap、Basic Shapley、边际贡献累计、权重归一化或权重校正。
- 不按权重分配金额，不计算数据源收益池，不计算优先分配后余额。
- 不计算合同约束前后差额、保底/封顶/固定比例调整或尾差。
- 不在前端拼业务口径图表数据；图表必须消费后端字段或 chart DTO。
- 不用 mock success 掩盖后端缺口。

## 后端缺口处理

- 后端没有对应 P0 能力时，前端不新增可执行按钮、不新增假入口、不新增假页面。
- 可以展示只读规划态、缺口说明、禁用按钮和下一步后端任务。
- P1 功能如 PDF、登录、RBAC、模板导入、任务进度和历史报告必须调用后端 P1 接口；后端不可用时只显示失败或不可用，不得前端伪造成功。
- 缺少图表结构时，记录后端需新增展示 DTO；不要由前端推导业务值。

## DTO 约束

页面指标、表格和图表应来自以下来源之一：

- 后端响应字段。
- 后端分页表格 DTO。
- 后端详情 DTO。
- 后端 trace DTO。
- 后端 snapshot / report / export DTO。
- 后端 chart DTO。

推荐 chart DTO 最少包含：

```json
{
  "chart_id": "allocation_flow",
  "title": "收益分配流向",
  "source_result_id": "allocation_result_xxx",
  "generated_at": "2026-06-23T10:00:00+08:00",
  "series": [],
  "metadata": {
    "disclaimer": "系统结果仅为模拟参考，非法律结算 / 非法定结算结果"
  }
}
```

## 实施顺序

1. 先查 `docs/ui_backend_api_contract_mapping.md`，确认 action 是否 `EXISTING`、`PARTIAL`、`MISSING`、`MOCK_ONLY_P1`。
2. 再查 `docs/api_and_data_contract.md` 和 `backend/openapi.yaml`，确认字段和错误信封。
3. 页面只绑定已存在或明确可接入的接口。
4. 对缺口写禁用态、规划态或后端任务说明。
5. 对所有计算类按钮接入前置条件检查。
6. 对所有导出类按钮接入后端导出接口，并展示 `report_id`、`checksum`、生成时间。

## 自检清单

- 页面是否没有新增业务计算函数。
- 图表数据是否来自后端字段或 chart DTO。
- 权重是否只格式化到 6 位，不在前端归一化。
- 金额是否只格式化到 2 位，不在前端重算。
- 后端缺失能力是否没有被包装成成功状态。
- P1 功能是否没有伪装成 P0 已实现。
- 页面是否显示模拟参考、非法律结算边界。
