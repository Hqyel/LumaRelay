import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./button.js";

export interface DialogProps {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title: string;
  trigger?: ReactNode;
}

export function Dialog({
  children,
  description,
  footer,
  onOpenChange,
  open,
  title,
  trigger,
}: DialogProps) {
  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      {trigger === undefined ? null : (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-sm data-[state=open]:animate-[newemby-fade-in_150ms_ease-out]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-panel border border-border bg-glass p-6 shadow-panel backdrop-blur-xl data-[state=open]:animate-[newemby-dialog-in_250ms_cubic-bezier(0.16,1,0.3,1)] sm:p-8">
          <div className="pr-12">
            <DialogPrimitive.Title className="text-h3 font-semibold text-text">
              {title}
            </DialogPrimitive.Title>
            {description === undefined ? null : (
              <DialogPrimitive.Description className="mt-2 text-body text-text-muted">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <div className="mt-6">{children}</div>
          {footer === undefined ? null : (
            <div className="mt-8 flex justify-end gap-3 border-t border-border pt-5">
              {footer}
            </div>
          )}
          <DialogPrimitive.Close asChild>
            <Button
              aria-label="关闭弹层"
              className="absolute right-4 top-4"
              size="icon"
              variant="ghost"
            >
              <X aria-hidden="true" size={20} />
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
