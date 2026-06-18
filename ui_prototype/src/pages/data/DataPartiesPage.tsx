import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function DataPartiesPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="参与方管理"
      subtitle="维护数据源主体与非数据贡献主体，控制算法权重池边界。"
      bodyTitle="参与方边界工作台"
      bodyPlaceholder="这里承载参与方类型、资源关联、是否进入算法权重池和停用状态。"
    />
  );
}
