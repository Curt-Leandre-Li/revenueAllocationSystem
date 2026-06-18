import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="sectionCard">
      <div className="sectionHead">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
