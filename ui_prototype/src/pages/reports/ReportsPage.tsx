import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function ReportsPage(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="报告生成与导出"
      subtitle="预览报告并导出 Markdown、CSV、JSON、JSONL，PDF 保持 P1 禁用。"
      bodyTitle="报告导出工作台"
      bodyPlaceholder="这里承载报告类型、字段范围、导出格式、版本、校验和和 P1 PDF 边界。"
    />
  );
}
