import type { SVGProps } from "react";

export interface BrandMarkProps extends SVGProps<SVGSVGElement> {
  title?: string;
}

export function BrandMark({ title, ...props }: BrandMarkProps) {
  return (
    <svg
      aria-hidden={title === undefined}
      aria-label={title}
      role={title === undefined ? undefined : "img"}
      viewBox="0 0 48 48"
      {...props}
    >
      <path
        fill="currentColor"
        d="M11 5.75a4 4 0 0 1 4.13.2l25.2 14.57a4 4 0 0 1 0 6.92L15.13 42A4 4 0 0 1 9 38.54V9.42a4 4 0 0 1 2-3.67Z"
      />
      <path
        fill="var(--color-text, #f5f7fa)"
        fillOpacity=".94"
        d="M18 15.5c0-1.2 1.33-1.92 2.34-1.27l14.52 9.36a1.5 1.5 0 0 1 0 2.52l-14.52 9.36A1.5 1.5 0 0 1 18 34.2V15.5Z"
      />
    </svg>
  );
}
