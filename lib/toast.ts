import type { ExternalToast } from "sonner";

type ToastKind = "error" | "info" | "success" | "warning";

/** Shows one kind of message; sonner loads on the first call instead of at start-up. */
type ShowToast = (message: string, data?: ExternalToast) => void;

async function showWhenLoaded(
  kind: ToastKind,
  message: string,
  data?: ExternalToast,
): Promise<void> {
  const { toast } = await import("sonner");
  toast[kind](message, data);
}

function show(kind: ToastKind): ShowToast {
  return (message, data) => {
    void showWhenLoaded(kind, message, data);
  };
}

/**
 * The subset of sonner's `toast` the app uses. Importing sonner directly put about 9 KB into
 * the start-up JavaScript; the toaster that renders the messages loads lazily too
 * (`components/providers/lazy-toaster.tsx`).
 */
export const toast = {
  error: show("error"),
  info: show("info"),
  success: show("success"),
  warning: show("warning"),
} as const;
