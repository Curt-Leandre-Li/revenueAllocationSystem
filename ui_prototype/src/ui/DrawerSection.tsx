import type { ReactNode } from "react";

export interface DrawerSectionProps {
  title: string;
  description?: string;
  extra?: ReactNode;
  children: ReactNode;
}

export function DrawerSection({ title, description, extra, children }: DrawerSectionProps) {
  return (
    <section className="drawerSection">
      <div className="drawerSectionHead">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {extra ? <div className="drawerSectionExtra">{extra}</div> : null}
      </div>
      <div className="drawerSectionBody">{children}</div>
    </section>
  );
}
