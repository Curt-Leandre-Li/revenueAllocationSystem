import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function OneClickPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="一键计算"
      subtitle="展示完整链路计算前置条件、运行模式、默认算法和失败节点。"
      bodyTitle="一键计算工作台"
      bodyPlaceholder="这里承载前置检查、流水线阶段、停止节点和计算结果追溯入口。"
    />
  );
}
