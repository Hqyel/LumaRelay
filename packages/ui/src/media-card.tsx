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
      className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-black/60"
      role="progressbar"
    >
      <span
        className="block h-full rounded-full bg-accent"
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
    <article className="group min-w-0">
      <div className="relative aspect-[2/3] overflow-hidden rounded-poster border border-border bg-surface shadow-card transition-transform duration-120 group-hover:-translate-y-1">
        <ImageFallback
          alt={title}
          className="transition-transform duration-200 group-hover:scale-[1.03]"
          containerClassName="size-full"
          loading="lazy"
          src={imageUrl}
        />
        {favorite ? (
          <span
            aria-label="已收藏"
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/65 text-text"
            role="img"
          >
            <Heart aria-hidden="true" fill="currentColor" size={16} />
          </span>
        ) : null}
        {unwatchedCount === undefined ? null : (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-1 text-label font-semibold text-on-accent">
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
      <h3 className="mt-3 line-clamp-2 text-body font-semibold text-text">
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
    <article className="group overflow-hidden rounded-panel border border-border bg-surface shadow-card">
      <div className="relative aspect-video overflow-hidden">
        <ImageFallback
          alt={title}
          className="transition-transform duration-200 group-hover:scale-[1.02]"
          containerClassName="size-full"
          loading="lazy"
          src={imageUrl}
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
