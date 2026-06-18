import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function ProcessPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="流程入口"
      subtitle="按完整链路组织数据接入、计量、权重、分配、报告和审计入口。"
      bodyTitle="流程推进工作台"
      bodyPlaceholder="这里承载链路节点、阻塞原因、下一模块和跨页面跳转动作。"
    />
  );
}
