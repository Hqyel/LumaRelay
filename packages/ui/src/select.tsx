import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
} from "react";

import { cn } from "./cn.js";
import {
  startOverflowMarquee,
  stopOverflowMarquee,
} from "./overflow-marquee.js";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(
  (
    {
      children,
      className,
      onKeyDown,
      onMouseEnter,
      onMouseLeave,
      onWheel,
      ...props
    },
    ref,
  ) => {
    const valueElement = (target: HTMLButtonElement): HTMLSpanElement | null =>
      target.querySelector<HTMLSpanElement>(".lumarelay-select-value-scroll");

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || !event.shiftKey) return;
      const value = valueElement(event.currentTarget);
      if (value === null || value.scrollWidth <= value.clientWidth) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        value.scrollBy({
          behavior: "smooth",
          left: event.key === "ArrowLeft" ? -80 : 80,
        });
      }
    };

    const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
      onMouseEnter?.(event);
      const value = valueElement(event.currentTarget);
      if (value !== null) startOverflowMarquee(value);
    };

    const handleMouseLeave = (event: MouseEvent<HTMLButtonElement>) => {
      onMouseLeave?.(event);
      const value = valueElement(event.currentTarget);
      if (value !== null) stopOverflowMarquee(value);
    };

    const handleWheel = (event: WheelEvent<HTMLButtonElement>) => {
      onWheel?.(event);
      if (event.defaultPrevented) return;
      const value = valueElement(event.currentTarget);
      if (value === null || value.scrollWidth <= value.clientWidth) return;
      const distance =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (distance === 0) return;
      event.preventDefault();
      value.scrollLeft += distance;
    };

    return (
      <SelectPrimitive.Trigger
        className={cn(
          "lumarelay-select-trigger flex h-11 w-full items-center justify-between rounded-control border " +
            "border-border bg-field px-3 text-body text-text shadow-[inset_0_1px_rgb(var(--theme-foreground-rgb)_/_4%)] " +
            "outline-none backdrop-blur-xl transition-[border-color,box-shadow,background] duration-150 " +
            "hover:border-border-hover focus:border-accent focus:shadow-[0_0_0_3px_rgb(124_92_255_/_20%)] " +
            "data-[placeholder]:text-text-subtle data-[state=open]:border-accent " +
            "data-[state=open]:[&_svg]:rotate-180 [&_svg]:transition-transform",
          className,
        )}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        ref={ref}
        {...props}
      >
        <span className="lumarelay-select-value-scroll">{children}</span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" size={17} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ children, className, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      className={cn(
        "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden " +
          "rounded-control border border-border bg-glass p-1 shadow-panel backdrop-blur-xl " +
          "data-[state=open]:animate-[lumarelay-select-in_150ms_cubic-bezier(0.16,1,0.3,1)]",
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
        "pr-9 text-body text-text outline-none data-[highlighted]:bg-accent/12 " +
        "data-[state=checked]:bg-[linear-gradient(135deg,rgb(124_92_255_/_18%),rgb(118_75_162_/_12%))] data-[state=checked]:text-accent-hover " +
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
