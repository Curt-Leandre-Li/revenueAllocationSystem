import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function DataPackagesPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="数据接入管理"
      subtitle="选择演示数据、上传 UTF-8 JSON、校验必要字段并生成输入快照。"
      bodyTitle="数据包接入工作台"
      bodyPlaceholder="这里承载演示数据、上传校验、失败字段、修复建议和输入快照状态。"
    />
  );
}
