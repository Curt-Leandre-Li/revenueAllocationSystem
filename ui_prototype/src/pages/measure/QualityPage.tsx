import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function QualityPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="质量评估管理"
      subtitle="配置质量权重、运行质量评估，并展示证据、预警和版本。"
      bodyTitle="质量评估工作台"
      bodyPlaceholder="这里承载质量指标权重、总分、质量因子、低质量预警和评估版本。"
    />
  );
}
