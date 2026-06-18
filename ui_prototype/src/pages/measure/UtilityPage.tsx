import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function UtilityPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="贡献度与效用计算"
      subtitle="计算贡献度、归一化贡献和效用值，为 MD-DShap 提供输入。"
      bodyTitle="贡献效用工作台"
      bodyPlaceholder="这里承载贡献因子、质量因子、使用因子、效用函数和计算轨迹。"
    />
  );
}
