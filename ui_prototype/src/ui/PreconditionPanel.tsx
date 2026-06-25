import { checkStatusLabels } from "../domain/status";
import type { PreconditionItem, RoutePath } from "../domain/types";
import { userFacingText } from "./displayText";

interface PreconditionPanelProps {
  items: PreconditionItem[];
  onNavigate?: (path: RoutePath) => void;
}

export function PreconditionPanel({ items, onNavigate }: PreconditionPanelProps) {
  if (items.length === 0) {
    return (
      <div className="preconditionList">
        <article className="precondition pending">
          <div>
            <strong>等待前置条件</strong>
            <span>待处理</span>
          </div>
          <p>系统暂未返回前置条件；页面不会自行判定业务条件。</p>
        </article>
      </div>
    );
  }

  return (
    <div className="preconditionList">
      {items.map((item) => (
        <article className={`precondition ${item.status.toLowerCase()}`} key={item.name}>
          <div>
            <strong>{userFacingText(item.name)}</strong>
            <span>{checkStatusLabels[item.status]}</span>
          </div>
          <p>{userFacingText(item.message)}</p>
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
