"use client";

import type { ComponentProps } from "react";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";

/**
 *
 * @param root0
 */
function AlertDialog({
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

/**
 *
 * @param root0
 */
function AlertDialogPortal({
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

/**
 *
 * @param root0
 * @param root0.className
 */
function AlertDialogOverlay({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      data-slot="alert-dialog-overlay"
      {...props}
    />
  );
}

/**
 *
 * @param root0
 * @param root0.className
 * @param root0.onClickOutside
 */
function AlertDialogContent({
  className,
  onClickOutside,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content> & {
  onClickOutside?: () => void;
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay onClick={onClickOutside} />
      <AlertDialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className,
        )}
        data-slot="alert-dialog-content"
        {...props}
      />
    </AlertDialogPortal>
  );
}

/**
 *
 * @param root0
 * @param root0.className
 */
function AlertDialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      data-slot="alert-dialog-header"
      {...props}
    />
  );
}

/**
 *
 * @param root0
 * @param root0.className
 */
function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn(
        "font-[family-name:var(--font-playfair)] text-xl font-semibold",
        className,
      )}
      data-slot="alert-dialog-title"
      {...props}
    />
  );
}

/**
 *
 * @param root0
 * @param root0.className
 */
function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="alert-dialog-description"
      {...props}
    />
  );
}

/**
 *
 * @param root0
 * @param root0.className
 */
function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      data-slot="alert-dialog-footer"
      {...props}
    />
  );
}

/**
 *
 * @param root0
 * @param root0.className
 */
function AlertDialogAction({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      data-slot="alert-dialog-action"
      {...props}
    />
  );
}

/**
 *
 * @param root0
 * @param root0.className
 */
function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      data-slot="alert-dialog-cancel"
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
};
