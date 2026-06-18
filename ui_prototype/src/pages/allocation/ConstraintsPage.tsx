import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function ConstraintsPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="合同约束管理"
      subtitle="维护最小额、封顶、固定比例、优先分配等合同约束。"
      bodyTitle="合同约束工作台"
      bodyPlaceholder="这里承载约束对象、约束类型、优先级、启停状态和应用结果。"
    />
  );
}
