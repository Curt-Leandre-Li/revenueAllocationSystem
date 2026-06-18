import { checkStatusLabels } from "../domain/status";
import type { PreconditionItem, RoutePath } from "../domain/types";

interface PreconditionPanelProps {
  items: PreconditionItem[];
  onNavigate?: (path: RoutePath) => void;
}

export function PreconditionPanel({ items, onNavigate }: PreconditionPanelProps) {
  return (
    <div className="preconditionList">
      {items.map((item) => (
        <article className={`precondition ${item.status.toLowerCase()}`} key={item.name}>
          <div>
            <strong>{item.name}</strong>
            <span>{checkStatusLabels[item.status]}</span>
          </div>
          <p>{item.message}</p>
          {item.targetPath && onNavigate ? (
            <button type="button" onClick={() => onNavigate(item.targetPath!)}>
              前往处理
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
