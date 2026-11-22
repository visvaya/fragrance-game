import { X } from "lucide-react";

import {
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
