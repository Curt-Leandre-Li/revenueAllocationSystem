import type { DataRow } from "../domain/types";

interface TechnicalDetailsProps {
  details: DataRow;
}

export function TechnicalDetails({ details }: TechnicalDetailsProps) {
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return null;
  }

  return (
    <details className="technicalDetails">
      <summary>技术详情</summary>
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
