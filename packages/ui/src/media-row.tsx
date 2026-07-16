import type { ReactNode } from "react";

import { ImageFallback } from "./image-fallback.js";

export interface MediaRowProps {
  action?: ReactNode;
  description?: string;
  imageUrl?: string;
  metadata?: string;
  progress?: number;
  title: string;
}

export function MediaRow({
  action,
  description,
  imageUrl,
  metadata,
  progress,
  title,
}: MediaRowProps) {
  const normalizedProgress =
    progress === undefined ? undefined : Math.min(100, Math.max(0, progress));

  return (
    <article className="grid grid-cols-[8rem_1fr_auto] items-center gap-4 rounded-panel border border-border bg-surface p-3 transition-colors hover:bg-surface-hover sm:grid-cols-[12rem_1fr_auto]">
      <div className="relative aspect-video overflow-hidden rounded-poster">
        <ImageFallback
          alt={title}
          containerClassName="size-full"
          loading="lazy"
          src={imageUrl}
        />
        {normalizedProgress === undefined ? null : (
          <span
            aria-label={`播放进度 ${normalizedProgress}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={normalizedProgress}
            className="absolute inset-x-0 bottom-0 h-1 bg-black/60"
            role="progressbar"
          >
            <span
              className="block h-full bg-accent"
              style={{ width: `${normalizedProgress}%` }}
            />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-body font-semibold">{title}</h3>
        {metadata === undefined ? null : (
          <p className="mt-1 text-small text-text-muted">{metadata}</p>
        )}
        {description === undefined ? null : (
          <p className="mt-2 line-clamp-2 text-small text-text-muted">
            {description}
          </p>
        )}
      </div>
      {action === undefined ? null : <div>{action}</div>}
    </article>
  );
}
