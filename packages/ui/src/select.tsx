import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "./cn.js";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ children, className, ...props }, ref) => (
  <SelectPrimitive.Trigger
    className={cn(
      "flex h-11 w-full items-center justify-between rounded-control border " +
        "border-border bg-bg-elevated px-3 text-body text-text data-[placeholder]:text-text-muted",
      className,
    )}
    ref={ref}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown aria-hidden="true" size={17} />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ children, className, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      className={cn(
        "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden " +
          "rounded-control border border-border bg-surface p-1 shadow-panel",
        className,
      )}
      position={position}
      ref={ref}
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ children, className, ...props }, ref) => (
  <SelectPrimitive.Item
    className={cn(
      "relative flex min-h-10 select-none items-center rounded-control py-2 pl-3 " +
        "pr-9 text-body text-text outline-none data-[highlighted]:bg-surface-hover " +
        "data-[disabled]:opacity-40",
      className,
    )}
    ref={ref}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-3">
      <Check aria-hidden="true" size={16} />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
