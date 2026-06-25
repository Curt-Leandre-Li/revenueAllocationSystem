import type { ActionDefinition } from "../domain/types";
import { userFacingText } from "./displayText";

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
      title={userFacingText(disabledReason || action.sideEffect)}
      type="button"
      onClick={() => onClick(action)}
    >
      {userFacingText(action.label)}
      {disabledReason ? <small>{userFacingText(disabledReason)}</small> : null}
    </button>
  );
}
