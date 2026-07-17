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
    <article className="group grid grid-cols-[8rem_1fr_auto] items-center gap-4 rounded-panel border border-white/10 bg-[#141423]/70 p-3 shadow-[0_2px_8px_rgb(0_0_0_/_20%)] backdrop-blur-xl transition-[background,border-color,box-shadow,transform] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-white/15 hover:bg-accent/10 hover:shadow-[0_8px_28px_rgb(0_0_0_/_30%)] motion-reduce:transform-none sm:grid-cols-[12rem_1fr_auto]">
      <div className="relative aspect-video overflow-hidden rounded-poster bg-[#1a1a2e]">
        <ImageFallback
          alt={title}
          className="transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 motion-reduce:transform-none"
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
              className="block h-full bg-[linear-gradient(90deg,#7C5CFF,#F093FB)] shadow-[0_0_8px_rgb(124_92_255_/_70%)]"
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
