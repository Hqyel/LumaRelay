import { useState, type ImgHTMLAttributes } from "react";

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
  const initial = alt.trim().charAt(0).toLocaleUpperCase() || "N";

  return (
    <span
      className={cn(
        "relative block overflow-hidden bg-surface-hover",
        containerClassName,
      )}
    >
      {!loaded && !failed ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-surface-hover motion-reduce:animate-none"
        />
      ) : null}
      {failed ? (
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
