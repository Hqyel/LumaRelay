import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn.js";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-control bg-surface-hover motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

interface StateProps {
  action?: ReactNode;
  description: string;
  icon?: ReactNode;
  title: string;
}

export function EmptyState({ action, description, icon, title }: StateProps) {
  return (
    <section className="grid min-h-64 place-items-center rounded-panel border border-dashed border-border p-8 text-center">
      <div className="max-w-md">
        {icon === undefined ? null : (
          <div
            aria-hidden="true"
            className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-surface-hover text-text-muted"
          >
            {icon}
          </div>
        )}
        <h2 className="text-h3 font-semibold">{title}</h2>
        <p className="mt-2 text-body text-text-muted">{description}</p>
        {action === undefined ? null : <div className="mt-5">{action}</div>}
      </div>
    </section>
  );
}

export function ErrorState({ action, description, icon, title }: StateProps) {
  return (
    <section
      aria-live="polite"
      className="grid min-h-64 place-items-center rounded-panel border border-danger/35 bg-danger/5 p-8 text-center"
      role="alert"
    >
      <div className="max-w-md">
        {icon === undefined ? null : (
          <div
            aria-hidden="true"
            className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-danger/12 text-danger"
          >
            {icon}
          </div>
        )}
        <h2 className="text-h3 font-semibold">{title}</h2>
        <p className="mt-2 text-body text-text-muted">{description}</p>
        {action === undefined ? null : <div className="mt-5">{action}</div>}
      </div>
    </section>
  );
}
