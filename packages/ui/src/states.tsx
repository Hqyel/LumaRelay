import { FolderOpen, TriangleAlert } from "lucide-react";
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
        "relative overflow-hidden rounded-control bg-white/[0.055] before:absolute " +
          "before:inset-0 before:-translate-x-full before:animate-[newemby-shimmer_1.6s_infinite] " +
          "before:bg-[linear-gradient(90deg,transparent,rgb(255_255_255_/_7%),transparent)] " +
          "motion-reduce:before:animate-none",
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
  const stateIcon = icon ?? <FolderOpen size={24} />;

  return (
    <section
      className="grid min-h-64 place-items-center rounded-panel border border-dashed border-white/10 bg-[#141423]/55 p-8 text-center shadow-card backdrop-blur-xl"
      data-newemby-state="empty"
    >
      <div className="max-w-md">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgb(124_92_255_/_22%),rgb(240_147_251_/_10%))] text-accent-hover shadow-[0_0_28px_rgb(124_92_255_/_18%)]"
        >
          {stateIcon}
        </div>
        <h2 className="text-h3 font-semibold text-white">{title}</h2>
        <p className="mt-2 text-body text-text-muted">{description}</p>
        {action === undefined ? null : <div className="mt-5">{action}</div>}
      </div>
    </section>
  );
}

export function ErrorState({ action, description, icon, title }: StateProps) {
  const stateIcon = icon ?? <TriangleAlert size={24} />;

  return (
    <section
      aria-live="polite"
      className="grid min-h-64 place-items-center rounded-panel border border-danger/25 bg-[#141423]/65 p-8 text-center shadow-card backdrop-blur-xl"
      data-newemby-state="error"
      role="alert"
    >
      <div className="max-w-md">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-danger/20 bg-danger/10 text-danger shadow-[0_0_28px_rgb(240_101_101_/_12%)]"
        >
          {stateIcon}
        </div>
        <h2 className="text-h3 font-semibold text-white">{title}</h2>
        <p className="mt-2 text-body text-text-muted">{description}</p>
        {action === undefined ? null : <div className="mt-5">{action}</div>}
      </div>
    </section>
  );
}
