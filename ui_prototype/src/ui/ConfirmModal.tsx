import type { ActionDefinition } from "../domain/types";

interface ConfirmModalProps {
  action: ActionDefinition | null;
  onCancel: () => void;
  onConfirm: (action: ActionDefinition) => void;
}

export function ConfirmModal({ action, onCancel, onConfirm }: ConfirmModalProps) {
  if (!action) {
    return null;
  }

  return (
    <div className="modalBackdrop" role="presentation">
      <section className="confirmModal" role="dialog" aria-modal="true" aria-label="确认操作">
        <h2>确认执行</h2>
        <p>
          该操作将执行：<strong>{action.label}</strong>
        </p>
        <p className="modalEffect">{action.sideEffect}</p>
        <p className="modalRisk">结果仅作模拟参考，不作为法律结算、付款指令或合同履约依据。</p>
        <div className="modalActions">
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button className="primary" type="button" onClick={() => onConfirm(action)}>
            确认
          </button>
        </div>
      </section>
    </div>
  );
}
