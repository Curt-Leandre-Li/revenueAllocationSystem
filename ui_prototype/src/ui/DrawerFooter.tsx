import type { ReactNode } from "react";

export type DrawerAction = {
  label: string;
  type?: "primary" | "default" | "danger";
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
};

export interface DrawerFooterProps {
  note?: ReactNode;
  actions?: DrawerAction[];
}

export function DrawerFooter({ note, actions = [] }: DrawerFooterProps) {
  if (!note && actions.length === 0) {
    return null;
  }

  return (
    <div className="drawerFooter">
      <div className="drawerFooterNote">{note}</div>
      <div className="drawerFooterActions">
        {actions.map((action) => (
          <button
            className={`drawerAction ${action.type ?? "default"}`}
            disabled={action.disabled}
            key={action.label}
            title={action.disabled ? action.disabledReason : undefined}
            type="button"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
