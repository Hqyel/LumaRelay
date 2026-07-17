import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "./cn.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: ReactNode;
  label: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, hint, id, label, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? props.name ?? `newemby-input-${generatedId}`;
    const hintId = hint === undefined ? undefined : `${inputId}-hint`;
    const errorId = error === undefined ? undefined : `${inputId}-error`;
    const describedBy =
      [hintId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <label className="grid gap-2 text-small text-text" htmlFor={inputId}>
        <span className="font-semibold">{label}</span>
        <input
          aria-label={props["aria-label"] ?? label}
          aria-describedby={describedBy}
          aria-errormessage={errorId}
          aria-invalid={error === undefined ? undefined : true}
          className={cn(
            "h-11 w-full rounded-control border border-white/10 bg-[#1a1a2e]/80 px-3 " +
              "text-body text-text shadow-[inset_0_1px_rgb(255_255_255_/_4%)] outline-none " +
              "backdrop-blur-xl transition-[border-color,box-shadow,background] duration-150 " +
              "placeholder:text-white/40 hover:border-white/15 focus:border-accent " +
              "focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgb(124_92_255_/_20%)] " +
              "disabled:cursor-not-allowed disabled:opacity-45",
            error !== undefined && "border-danger",
            className,
          )}
          id={inputId}
          ref={ref}
          {...props}
        />
        {hint === undefined ? null : (
          <span className="text-text-muted" id={hintId}>
            {hint}
          </span>
        )}
        {error === undefined ? null : (
          <span
            aria-live="polite"
            className="text-danger"
            id={errorId}
            role="alert"
          >
            {error}
          </span>
        )}
      </label>
    );
  },
);
Input.displayName = "Input";
