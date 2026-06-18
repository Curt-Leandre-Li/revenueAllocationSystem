import { fieldLabels } from "../domain/fieldMap";

type ExportField =
  | string
  | {
      key: string;
      label?: string;
      description?: string;
      sensitive?: boolean;
    };

interface ExportFieldListProps {
  fields: ExportField[];
  title?: string;
  note?: string;
}

export function ExportFieldList({
  fields,
  title = "导出字段清单",
  note,
}: ExportFieldListProps) {
  return (
    <div className="exportFieldList">
      <div>
        <strong>{title}</strong>
        {note ? <p>{note}</p> : null}
      </div>
      <ul>
        {fields.map((field) => {
          const key = typeof field === "string" ? field : field.key;
          const label = typeof field === "string" ? fieldLabels[key] ?? key : field.label ?? fieldLabels[key] ?? key;
          const description = typeof field === "string" ? "" : field.description;
          const sensitive = typeof field === "string" ? false : field.sensitive;

          return (
            <li key={key}>
              <span>{label}</span>
              {description ? <small>{description}</small> : null}
              {sensitive ? <em>仅脱敏统计</em> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
