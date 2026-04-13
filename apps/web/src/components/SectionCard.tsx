import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function SectionCard({ title, subtitle, actions, children }: SectionCardProps) {
  return (
    <section className="section-card">
      <header className="section-card__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
