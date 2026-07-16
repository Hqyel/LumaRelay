import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "./cn.js";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold " +
    "transition-[background-color,color,border-color,transform] disabled:pointer-events-none " +
    "disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      size: {
        small: "min-h-9 px-3 text-small",
        medium: "min-h-11 px-5 text-body",
        large: "min-h-13 px-6 text-body",
        icon: "size-10",
      },
      variant: {
        primary: "bg-accent text-on-accent hover:bg-accent-hover",
        secondary:
          "border border-border bg-surface text-text hover:bg-surface-hover",
        ghost: "text-text-muted hover:bg-surface-hover hover:text-text",
        danger:
          "border border-danger/55 bg-danger/10 text-danger hover:bg-danger/20",
      },
    },
    defaultVariants: {
      size: "medium",
      variant: "primary",
    },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { asChild = false, className, size, type = "button", variant, ...props },
    ref,
  ) => {
    const Component = asChild ? Slot : "button";

    return (
      <Component
        className={cn(buttonStyles({ className, size, variant }))}
        ref={ref}
        type={asChild ? undefined : type}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
