import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export const ToastProvider = ToastPrimitive.Provider;

export interface ToastProps {
  action?: ReactNode;
  description?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title: string;
}

export function Toast({
  action,
  description,
  onOpenChange,
  open,
  title,
}: ToastProps) {
  return (
    <ToastPrimitive.Root
      className="grid grid-cols-[1fr_auto] gap-x-4 rounded-panel border border-border bg-glass p-4 shadow-panel backdrop-blur-xl data-[state=open]:animate-[lumarelay-toast-in_250ms_cubic-bezier(0.16,1,0.3,1)]"
      onOpenChange={onOpenChange}
      open={open}
    >
      <ToastPrimitive.Title className="text-body font-semibold">
        {title}
      </ToastPrimitive.Title>
      {description === undefined ? null : (
        <ToastPrimitive.Description className="mt-1 text-small text-text-muted">
          {description}
        </ToastPrimitive.Description>
      )}
      {action === undefined ? null : (
        <ToastPrimitive.Action altText="执行通知操作" asChild>
          {action}
        </ToastPrimitive.Action>
      )}
      <ToastPrimitive.Close
        aria-label="关闭通知"
        className="col-start-2 row-start-1 text-text-muted hover:text-text"
      >
        <X aria-hidden="true" size={18} />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastViewport() {
  return (
    <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] grid w-[calc(100%-2rem)] max-w-sm gap-3 outline-none" />
  );
}
