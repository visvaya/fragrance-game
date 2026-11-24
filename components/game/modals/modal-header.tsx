import type { ReactNode } from "react";

import { X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Header shared by the game modals: title, screen-reader description and a close button.
 */
export function ModalHeader({
  closeLabel,
  description,
  onClose,
  title,
}: Readonly<{
  closeLabel: string;
  description: string;
  onClose: () => void;
  title: string;
}>) {
  return (
    <DialogHeader className="flex flex-row items-center justify-between border-b border-border p-6 pb-4">
      <DialogTitle className="text-xl text-foreground">{title}</DialogTitle>
      <DialogDescription className="sr-only">{description}</DialogDescription>
      <button
        aria-label={closeLabel}
        className="text-muted-foreground transition-colors hover:text-primary"
        onClick={onClose}
      >
        <X className="size-5" />
      </button>
    </DialogHeader>
  );
}

/**
 * The dialog shared by the game modals: the frame, the header and the content below it.
 */
export function ModalFrame({
  children,
  closeLabel,
  description,
  onClose,
  open,
  title,
}: Readonly<{
  children: ReactNode;
  closeLabel: string;
  description: string;
  onClose: () => void;
  open: boolean;
  title: string;
}>) {
  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background p-0 sm:max-w-md"
        showCloseButton={false}
      >
        <ModalHeader
          closeLabel={closeLabel}
          description={description}
          onClose={onClose}
          title={title}
        />
        {children}
      </DialogContent>
    </Dialog>
  );
}
