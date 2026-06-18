import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function SimulationPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="收益分配模拟"
      subtitle="基于权重、优先分配和合同约束模拟收益分配结果。"
      bodyTitle="分配模拟工作台"
      bodyPlaceholder="这里承载总收益、优先分配、数据源收益池、约束前后金额和锁定动作。"
    />
  );
}
