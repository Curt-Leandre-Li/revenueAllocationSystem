import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function ShuyuanPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="数元计量管理"
      subtitle="配置基础单价、调用次数和多维系数，执行数元计量。"
      bodyTitle="数元计量工作台"
      bodyPlaceholder="这里承载基础价格、调用次数、质量/技术/专家/发展系数和计量金额。"
    />
  );
}
