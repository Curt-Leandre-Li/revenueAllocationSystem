import { ModulePageScaffold } from "./ModulePageScaffold";
import type { PageProps } from "./pageTypes";

export function WorkbenchPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title={props.route.label}
      subtitle={props.route.responsibility}
      bodyTitle="真实 API 摘要"
      bodyPlaceholder="默认读取 Phase 2A/2B PostgreSQL API；缺少明细接口时只展示项目级摘要和接口缺口。"
    />
  );
}
