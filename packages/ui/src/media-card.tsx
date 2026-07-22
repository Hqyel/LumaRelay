import { Heart, Play } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./button.js";
import { ImageFallback } from "./image-fallback.js";

function Progress({ value }: { value: number }) {
  const bounded = Math.min(100, Math.max(0, value));

  return (
    <span
      aria-label={`播放进度 ${bounded}%`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={bounded}
      className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-black/55"
      role="progressbar"
    >
      <span
        className="block h-full bg-[linear-gradient(90deg,#7C5CFF,#F093FB)] shadow-[0_0_8px_rgb(124_92_255_/_70%)]"
        style={{ width: `${bounded}%` }}
      />
    </span>
  );
}

export interface PosterCardProps {
  action?: ReactNode;
  favorite?: boolean;
  imageUrl?: string;
  progress?: number;
  subtitle?: string;
  title: string;
  unwatchedCount?: number;
}

export function PosterCard({
  action,
  favorite = false,
  imageUrl,
  progress,
  subtitle,
  title,
  unwatchedCount,
}: PosterCardProps) {
  return (
    <article className="group min-w-0 transition-transform duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:scale-[1.02] motion-reduce:transform-none">
      <div className="relative aspect-[2/3] overflow-hidden rounded-poster border border-border bg-bg-elevated shadow-card transition-[border-color,box-shadow] duration-[250ms] group-hover:border-accent/60 group-hover:shadow-[0_12px_38px_rgb(var(--theme-shadow-rgb)_/_30%),0_0_20px_rgb(124_92_255_/_22%)]">
        <ImageFallback
          alt={title}
          className="transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08] motion-reduce:transform-none"
          containerClassName="size-full"
          height={360}
          loading="lazy"
          src={imageUrl}
          width={240}
        />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-70 transition-opacity duration-[250ms] group-hover:opacity-100" />
        {favorite ? (
          <span
            aria-label="已收藏"
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full border border-white/10 bg-black/60 text-white shadow-sm backdrop-blur-md"
            role="img"
          >
            <Heart aria-hidden="true" fill="currentColor" size={16} />
          </span>
        ) : null}
        {unwatchedCount === undefined ? null : (
          <span className="absolute left-2 top-2 rounded-full bg-[linear-gradient(135deg,#7C5CFF,#764BA2)] px-2 py-1 text-label font-semibold text-white shadow-sm">
            {unwatchedCount} 集未看
          </span>
        )}
        {action === undefined ? null : (
          <div className="absolute inset-x-3 bottom-5 translate-y-3 opacity-0 transition-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            {action}
          </div>
        )}
        {progress === undefined ? null : <Progress value={progress} />}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-body font-semibold text-text transition-colors duration-150 group-hover:text-accent-hover">
        {title}
      </h3>
      {subtitle === undefined ? null : (
        <p className="mt-1 truncate text-small text-text-muted">{subtitle}</p>
      )}
    </article>
  );
}

export interface ContinueWatchingCardProps {
  imageUrl?: string;
  onContinue?: () => void;
  progress: number;
  remaining: string;
  title: string;
}

export function ContinueWatchingCard({
  imageUrl,
  onContinue,
  progress,
  remaining,
  title,
}: ContinueWatchingCardProps) {
  return (
    <article className="group overflow-hidden rounded-panel border border-border bg-surface shadow-card backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:border-accent/60 hover:shadow-[0_12px_38px_rgb(var(--theme-shadow-rgb)_/_30%),0_0_20px_rgb(124_92_255_/_18%)] motion-reduce:transform-none">
      <div className="relative aspect-video overflow-hidden">
        <ImageFallback
          alt={title}
          className="transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08] motion-reduce:transform-none"
          containerClassName="size-full"
          height={360}
          loading="lazy"
          src={imageUrl}
          width={640}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
        <Button
          aria-label={`继续播放 ${title}`}
          className="absolute bottom-5 left-5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={onContinue}
          size="small"
        >
          <Play aria-hidden="true" fill="currentColor" size={16} />
          继续播放
        </Button>
        <Progress value={progress} />
      </div>
      <div className="p-4">
        <h3 className="truncate text-body font-semibold">{title}</h3>
        <p className="mt-1 text-small text-text-muted">剩余 {remaining}</p>
      </div>
    </article>
  );
}
