import type { DataRow, FieldDefinition } from "../domain/types";
import { EmptyGuide } from "./EmptyGuide";

interface DataTableProps {
  columns: FieldDefinition[];
  rows: DataRow[];
  onSelectRow?: (row: DataRow) => void;
}

export function DataTable({ columns, rows, onSelectRow }: DataTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyGuide
        title="暂无业务数据"
        description="先完成当前页面的前置动作，系统会在此展示业务字段和结果。"
      />
    );
  }

  return (
    <div className="tableWrap">
      <table className="dataTable">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            {onSelectRow ? <th className="rowAction">操作</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${columns[0]}`}>
              {columns.map((column) => (
                <td key={column.key}>{String(row[column.key] ?? "-")}</td>
              ))}
              {onSelectRow ? (
                <td className="rowAction">
                  <button type="button" onClick={() => onSelectRow(row)}>
                    详情
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
