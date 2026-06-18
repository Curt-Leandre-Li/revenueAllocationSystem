import type { ReactNode } from "react";

interface DetailDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function DetailDrawer({ open, title, onClose, children }: DetailDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <aside className="drawer" aria-label={title}>
      <div className="drawerPanel">
        <div className="drawerHead">
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="drawerBody">{children}</div>
      </div>
    </aside>
  );
}
