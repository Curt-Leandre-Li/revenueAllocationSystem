import type { DataRow } from "../domain/types";
import { fieldLabels } from "../domain/fieldMap";

interface TechnicalDetailsProps {
  details: DataRow;
  title?: string;
  description?: string;
  defaultOpen?: boolean;
}

export function TechnicalDetails({
  details,
  title = "技术详情",
  description = "工程字段默认收起，仅用于审计追溯。",
  defaultOpen = false,
}: TechnicalDetailsProps) {
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return null;
  }

  return (
    <details className="technicalDetails" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <small>{description}</small>
      </summary>
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>
              {fieldLabels[key] ?? key}
              <small>{key}</small>
            </dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
