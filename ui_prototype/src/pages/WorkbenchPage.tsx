import { ModulePageScaffold } from "./ModulePageScaffold";
import type { PageProps } from "./pageTypes";

export function WorkbenchPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title={props.route.label}
      subtitle="基础兜底页面，仅在路由组件未绑定时使用。"
      bodyTitle="基础工作区模板"
      bodyPlaceholder="该页面用于兜底渲染，不作为任何主业务页面的长期实现。"
    />
  );
}
