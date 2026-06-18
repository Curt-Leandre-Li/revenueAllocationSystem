import type { ActionDefinition } from "../domain/types";

interface ConfirmModalProps {
  action?: ActionDefinition | null;
  open?: boolean;
  title?: string;
  description?: string;
  effect?: string;
  risk?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmType?: "primary" | "danger";
  onCancel: () => void;
  onConfirm?: (action: ActionDefinition) => void;
  onConfirmGeneric?: () => void;
}

export function ConfirmModal({
  action,
  open,
  title,
  description,
  effect,
  risk,
  confirmLabel = "确认",
  cancelLabel = "取消",
  confirmType = "primary",
  onCancel,
  onConfirm,
  onConfirmGeneric,
}: ConfirmModalProps) {
  const isOpen = Boolean(action) || Boolean(open);
  if (!isOpen) {
    return null;
  }

  const modalTitle = title ?? "确认执行";
  const modalDescription =
    description ?? (action ? `该操作将执行：${action.label}` : "请确认是否继续执行该操作。");
  const modalEffect = effect ?? action?.sideEffect;
  const modalRisk =
    risk ?? "结果仅作模拟参考，不作为法律结算、付款指令或合同履约依据。";

  return (
    <div className="modalBackdrop" role="presentation">
      <section className="confirmModal" role="dialog" aria-modal="true" aria-label="确认操作">
        <h2>{modalTitle}</h2>
        <p>{modalDescription}</p>
        {modalEffect ? <p className="modalEffect">{modalEffect}</p> : null}
        <p className="modalRisk">{modalRisk}</p>
        <div className="modalActions">
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={confirmType === "danger" ? "danger" : "primary"}
            type="button"
            onClick={() => {
              if (action && onConfirm) {
                onConfirm(action);
                return;
              }
              onConfirmGeneric?.();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
