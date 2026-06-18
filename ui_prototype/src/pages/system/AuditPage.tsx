import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function AuditPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="审计日志管理"
      subtitle="查询操作、计算和导出日志，并查看输入、参数、输出和报告快照。"
      bodyTitle="审计追溯工作台"
      bodyPlaceholder="这里承载日志查询、失败原因、快照详情和审计导出动作。"
    />
  );
}
