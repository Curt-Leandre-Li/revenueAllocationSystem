import type { ActionDefinition } from "../domain/types";

interface ActionButtonProps {
  action: ActionDefinition;
  disabledReason?: string;
  onClick: (action: ActionDefinition) => void;
}

export function ActionButton({ action, disabledReason, onClick }: ActionButtonProps) {
  return (
    <button
      className={`actionButton ${action.tone ?? "secondary"}`}
      disabled={Boolean(disabledReason)}
      title={disabledReason || action.sideEffect}
      type="button"
      onClick={() => onClick(action)}
    >
      <span>{action.id}</span>
      {action.label}
      {disabledReason ? <small>{disabledReason}</small> : null}
    </button>
  );
}
