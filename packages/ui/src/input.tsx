import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "./cn.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: ReactNode;
  label: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, hint, id, label, ...props }, ref) => {
    const inputId = id ?? props.name;
    const messageId = inputId === undefined ? undefined : `${inputId}-message`;

    return (
      <label className="grid gap-2 text-small text-text" htmlFor={inputId}>
        <span className="font-semibold">{label}</span>
        <input
          aria-label={props["aria-label"] ?? label}
          aria-describedby={messageId}
          aria-invalid={error === undefined ? undefined : true}
          className={cn(
            "h-11 w-full rounded-control border border-border bg-bg-elevated px-3 " +
              "text-body text-text placeholder:text-text-muted/70 hover:border-white/18 " +
              "disabled:cursor-not-allowed disabled:opacity-45",
            error !== undefined && "border-danger",
            className,
          )}
          id={inputId}
          ref={ref}
          {...props}
        />
        {error !== undefined || hint !== undefined ? (
          <span
            className={error === undefined ? "text-text-muted" : "text-danger"}
            id={messageId}
          >
            {error ?? hint}
          </span>
        ) : null}
      </label>
    );
  },
);
Input.displayName = "Input";
