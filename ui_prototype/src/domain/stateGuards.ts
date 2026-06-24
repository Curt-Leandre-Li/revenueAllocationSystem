import type { ActionDefinition, ActionId, StatusCode } from "./types";
import { isLockedStatus } from "./status";

export const simulationDisclaimer =
  "系统结果仅为模拟参考，非法律结算 / 非法定结算结果。";

export const p0OperatorId = "local_operator";

export const backendMissingActionReasons: Partial<Record<ActionId, string>> = {
  "DATA-009": "后端未提供数据包停用接口，P0 不显示假停用成功。",
  "RES-007": "后端未提供资源摘要导出接口，P0 不生成前端模拟导出。",
  "MDS-017": "后端未提供纯算法权重结果导出接口，可使用算法审计导出。",
  "ALLOC-014": "后端未提供复制分配方案接口，已确认/已导出版本不做前端假复制。",
  "REP-009": "后端未提供收益分配确认书专用导出接口，P0 暂不启用。",
};

export const p1ActionReasons: Partial<Record<ActionId, string>> = {
  "REP-003": "PDF 导出是 P1 规划能力，P0 仅支持 Markdown / CSV / JSON / JSONL。",
  "USER-001": "登录与 RBAC 是 P1 规划能力，P0 使用本地操作员。",
  "USER-002": "用户新增是 P1 规划能力，P0 不创建生产账号。",
  "USER-007": "密码重置是 P1 规划能力，P0 无登录密码流程。",
  "USER-008": "角色管理是 P1 规划能力，P0 不保存生产权限。",
  "USER-009": "权限配置是 P1 规划能力，P0 不写 RBAC 配置。",
};

export const actionGuardNotes: Record<ActionId, string> = {
  "SYS-002": "调用后端演示数据初始化接口。",
  "SYS-004": "调用后端完整链路计算接口，先展示前置条件。",
  "SYS-005": "只读展示风险边界。",
  "DATA-002": "调用后端演示数据初始化接口。",
  "DATA-003": "仅提交用户选择并解析后的 JSON。",
  "DATA-007": "读取后端安全摘要或校验详情。",
  "DATA-008": "读取后端校验失败详情。",
  "DATA-009": backendMissingActionReasons["DATA-009"]!,
  "RES-002": "读取后端资源详情。",
  "RES-005": "只调用资源主体关系接口，不保存无契约开关。",
  "RES-007": backendMissingActionReasons["RES-007"]!,
  "PARTY-002": "调用后端参与方创建接口。",
  "PARTY-003": "调用后端参与方更新接口。",
  "PARTY-005": "调用后端参与方状态接口，并二次确认。",
  "PARTY-006": "当前以后端资源中心绑定接口为准。",
  "PARTY-008": "仅展示后端返回的贡献/效用/权重摘要。",
  "QUAL-002": "调用后端质量权重接口，前端不校验合计替代后端。",
  "QUAL-003": "调用后端质量评估接口。",
  "QUAL-006": "读取后端质量详情。",
  "QUAL-009": "调用后端重新评估接口，生成新版本。",
  "DU-002": "调用后端数元参数接口。",
  "DU-003": "调用后端调用量接口。",
  "DU-009": "调用后端数元计量接口。",
  "DU-010": "读取后端数元明细。",
  "UTIL-001": "调用后端贡献因子接口。",
  "UTIL-006": "调用后端贡献度计算接口。",
  "UTIL-007": "调用后端效用函数接口。",
  "UTIL-008": "调用后端效用值计算接口。",
  "UTIL-009": "读取后端效用 trace。",
  "PARAM-001": "调用后端参数版本接口。",
  "PARAM-002": "调用后端质量参数接口。",
  "PARAM-004": "调用后端 MD-DShap 参数接口。",
  "PARAM-008": "调用后端风险文案参数接口。",
  "MDS-011": "调用后端 MD-DShap 任务接口。",
  "MDS-012": "读取后端任务状态。",
  "MDS-013": "读取后端边际贡献 trace。",
  "MDS-014": "读取后端权重结果。",
  "MDS-015": "读取后端算法参数和说明。",
  "MDS-016": "调用后端重新计算接口，生成新任务。",
  "MDS-017": backendMissingActionReasons["MDS-017"]!,
  "MDS-018": "调用后端算法审计导出接口。",
  "ALLOC-003": "调用后端收益池草稿接口。",
  "ALLOC-005": "调用后端合同优先分配接口。",
  "ALLOC-007": "调用后端分配模式接口。",
  "ALLOC-011": "调用后端收益分配模拟接口。",
  "ALLOC-013": "读取后端方案结果或 trace。",
  "ALLOC-014": backendMissingActionReasons["ALLOC-014"]!,
  "ALLOC-015": "调用后端锁定接口，并二次确认。",
  "ALLOC-016": "调用后端分配结果导出接口。",
  "CONS-002": "调用后端合同约束创建接口。",
  "CONS-003": "调用后端合同约束更新接口。",
  "CONS-004": "调用后端合同约束状态接口，并二次确认。",
  "CONS-011": "读取后端约束应用 trace。",
  "REP-001": "读取后端报告预览。",
  "REP-002": "调用后端 Markdown 报告导出接口。",
  "REP-003": p1ActionReasons["REP-003"]!,
  "REP-004": "调用后端 CSV 导出接口。",
  "REP-005": "调用后端 JSON 导出接口。",
  "REP-006": "调用后端算法审计报告接口。",
  "REP-009": backendMissingActionReasons["REP-009"]!,
  "USER-001": p1ActionReasons["USER-001"]!,
  "USER-002": p1ActionReasons["USER-002"]!,
  "USER-007": p1ActionReasons["USER-007"]!,
  "USER-008": p1ActionReasons["USER-008"]!,
  "USER-009": p1ActionReasons["USER-009"]!,
  "AUD-002": "读取后端审计日志。",
  "AUD-006": "读取后端审计详情和快照引用。",
  "AUD-007": "调用后端审计 JSONL 导出接口。",
};

export function getContractDisabledReason(action: ActionDefinition) {
  return backendMissingActionReasons[action.id] ?? p1ActionReasons[action.id] ?? "";
}

export function getReadOnlyDisabledReason(action: ActionDefinition, projectStatus: StatusCode) {
  if (
    isLockedStatus(projectStatus) &&
    ["CREATE", "UPDATE", "DELETE_DISABLE", "CALCULATE", "CONFIRM"].includes(
      action.permission,
    )
  ) {
    return "项目已确认或已导出，只读查看和审计追溯可用；修改需后端复制新版本接口。";
  }
  return "";
}

