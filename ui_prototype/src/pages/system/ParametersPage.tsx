import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function ParametersPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="参数配置"
      subtitle="维护场景系数、质量权重、算法默认值、风险文案和精度规则。"
      bodyTitle="参数版本工作台"
      bodyPlaceholder="这里承载参数组、参数值、生效状态、版本号和前后值审计入口。"
    />
  );
}
