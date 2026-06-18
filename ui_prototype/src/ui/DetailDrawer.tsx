import { useEffect, useState, type ReactNode } from "react";
import { ConfirmModal } from "./ConfirmModal";
import { DrawerFooter, type DrawerAction } from "./DrawerFooter";

export type DrawerVariant = "detail" | "form" | "trace" | "export" | "risk";
export type DrawerSize = "sm" | "md" | "lg" | "xl" | "fullscreen";

export interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  variant?: DrawerVariant;
  size?: DrawerSize;
  title: string;
  subtitle?: string;
  statusTag?: string;
  objectType?: string;
  actionCode?: string;
  children: ReactNode;
  footerNote?: ReactNode;
  actions?: DrawerAction[];
  technicalDetails?: ReactNode;
  dirty?: boolean;
}

export function DetailDrawer({
  open,
  onClose,
  variant = "detail",
  size = "md",
  title,
  subtitle,
  statusTag,
  objectType,
  actionCode,
  children,
  footerNote,
  actions,
  technicalDetails,
  dirty = false,
}: DetailDrawerProps) {
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open || variant === "form") {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, variant]);

  if (!open) {
    return null;
  }

  function requestClose() {
    if (variant === "form" && dirty) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  }

  return (
    <aside
      className={`drawer drawer-${variant}`}
      aria-label={title}
      data-size={size}
      data-variant={variant}
    >
      <div className={`drawerPanel drawerPanel-${size}`}>
        <div className="drawerHead">
          <div className="drawerTitleBlock">
            <div className="drawerMeta">
              {objectType ? <span>{objectType}</span> : null}
              {actionCode ? <code>{actionCode}</code> : null}
              {statusTag ? <strong>{statusTag}</strong> : null}
            </div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" onClick={requestClose}>
            关闭
          </button>
        </div>
        <div className="drawerBody">
          {children}
          {technicalDetails ? <div className="drawerTechnical">{technicalDetails}</div> : null}
        </div>
        <DrawerFooter note={footerNote} actions={actions} />
      </div>
      <ConfirmModal
        open={closeConfirmOpen}
        title="放弃未保存修改？"
        description="当前表单存在未保存修改，关闭后本次编辑内容不会写入模拟记录。"
        effect="该操作只关闭当前表单抽屉，不影响已有审计和快照记录。"
        risk="请确认已不需要保存当前修改。"
        confirmLabel="放弃修改"
        confirmType="danger"
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirmGeneric={() => {
          setCloseConfirmOpen(false);
          onClose();
        }}
      />
    </aside>
  );
}

export const BusinessDrawer = DetailDrawer;
