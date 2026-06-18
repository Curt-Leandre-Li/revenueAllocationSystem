import type { ReactNode } from "react";

interface WorkbenchCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function WorkbenchCard({ title, description, actions, children }: WorkbenchCardProps) {
  return (
    <section className="workbenchCard">
      <div className="workbenchCardHead">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="cardActions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
