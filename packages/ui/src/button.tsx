import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "./cn.js";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold " +
    "transition-[background-color,color,border-color,box-shadow,transform] duration-[250ms] " +
    "ease-[cubic-bezier(0.16,1,0.3,1)] disabled:pointer-events-none disabled:opacity-45 " +
    "active:translate-y-px motion-reduce:transform-none",
  {
    variants: {
      size: {
        small: "min-h-9 px-3 text-small",
        medium: "min-h-11 px-5 text-body",
        large: "min-h-13 px-6 text-body",
        icon: "size-10",
      },
      variant: {
        primary:
          "bg-[linear-gradient(135deg,#7C5CFF_0%,#764BA2_100%)] text-on-accent " +
          "shadow-[0_2px_8px_rgb(0_0_0_/_20%)] hover:-translate-y-0.5 " +
          "hover:shadow-[0_4px_20px_rgb(0_0_0_/_30%),0_0_20px_rgb(124_92_255_/_30%)]",
        secondary:
          "border border-white/10 bg-[#1a1a2e]/80 text-text shadow-[inset_0_1px_rgb(255_255_255_/_4%)] " +
          "backdrop-blur-xl hover:-translate-y-0.5 hover:border-white/15 hover:bg-accent/10",
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
