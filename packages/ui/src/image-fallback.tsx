import { useEffect, useState, type ImgHTMLAttributes } from "react";

import { cn } from "./cn.js";

export interface ImageFallbackProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "alt"
> {
  alt: string;
  containerClassName?: string;
}

export function ImageFallback({
  alt,
  className,
  containerClassName,
  onError,
  onLoad,
  src,
  ...props
}: ImageFallbackProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const hasSource = typeof src === "string" && src.trim().length > 0;
  const initial = alt.trim().charAt(0).toLocaleUpperCase() || "N";

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  return (
    <span
      className={cn(
        "relative block overflow-hidden bg-surface-hover",
        containerClassName,
      )}
    >
      {hasSource && !loaded && !failed ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden bg-field before:absolute before:inset-0 before:-translate-x-full before:animate-[lumarelay-shimmer_1.6s_infinite] before:bg-[linear-gradient(90deg,transparent,rgb(var(--theme-foreground-rgb)_/_7%),transparent)] motion-reduce:before:animate-none"
        />
      ) : null}
      {!hasSource || failed ? (
        <span
          aria-label={`${alt} 图片不可用`}
          className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,var(--color-surface-hover),rgb(124_92_255_/_18%))] text-h2 font-semibold text-text-muted"
          role="img"
        >
          {initial}
        </span>
      ) : (
        <img
          alt={alt}
          className={cn(
            "size-full object-cover transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
            className,
          )}
          decoding="async"
          onError={(event) => {
            setFailed(true);
            onError?.(event);
          }}
          onLoad={(event) => {
            setLoaded(true);
            onLoad?.(event);
          }}
          src={src}
          {...props}
        />
      )}
    </span>
  );
}
