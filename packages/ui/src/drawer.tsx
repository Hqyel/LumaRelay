import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./button.js";

export interface DrawerProps {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title: string;
  trigger?: ReactNode;
}

export function Drawer({
  children,
  description,
  footer,
  onOpenChange,
  open,
  title,
  trigger,
}: DrawerProps) {
  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      {trigger === undefined ? null : (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-white/10 bg-[#141423]/94 p-6 shadow-panel backdrop-blur-xl data-[state=open]:animate-[newemby-drawer-in_250ms_cubic-bezier(0.16,1,0.3,1)] sm:p-8">
          <DialogPrimitive.Title className="pr-12 text-h3 font-semibold">
            {title}
          </DialogPrimitive.Title>
          {description === undefined ? null : (
            <DialogPrimitive.Description className="mt-2 text-body text-text-muted">
              {description}
            </DialogPrimitive.Description>
          )}
          <div className="mt-6 flex-1 overflow-auto">{children}</div>
          {footer === undefined ? null : (
            <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
              {footer}
            </div>
          )}
          <DialogPrimitive.Close asChild>
            <Button
              aria-label="关闭抽屉"
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
