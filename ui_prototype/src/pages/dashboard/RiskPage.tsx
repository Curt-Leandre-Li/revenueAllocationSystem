import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function RiskPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="风险提示"
      subtitle="集中展示模拟参考、非法律结算、敏感数据、算法、合同和报告边界。"
      bodyTitle="风险边界工作台"
      bodyPlaceholder="这里承载各类边界说明、P0 禁用项和高风险动作确认要求。"
    />
  );
}
