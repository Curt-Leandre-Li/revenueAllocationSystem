import { ModulePageScaffold } from "./ModulePageScaffold";
import type { PageProps } from "./pageTypes";

export function WorkbenchPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title={props.route.label}
      subtitle="临时 fallback 页面，仅在 route component 未绑定时使用。"
      bodyTitle="临时工作台"
      bodyPlaceholder="该页面用于兜底渲染，不作为任何 canonical 业务页面的长期实现。"
    />
  );
}
