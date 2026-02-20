"use client";

import { Suspense, useEffect } from "react";

import { useSearchParams } from "next/navigation";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

/**
 * Component that watches for Supabase Auth errors in the URL.
 * Supabase handles errors via query params or hash fragments.
 */
function AuthErrorWatcherInner() {
  const searchParameters = useSearchParams();
  const t = useTranslations("Auth.errorWatcher");

  useEffect(() => {
    // 1. Check query parameters (standard error redirects)
    const error = searchParameters.get("error");
    const description = searchParameters.get("error_description");

    if (error) {
      toast.error(t("title"), {
        description: description || t("defaultMessage"),
      });
      return;
    }

    // 2. Check hash fragment (OAuth errors)
    if (globalThis.window !== undefined && globalThis.location.hash) {
      const hashParameters = new URLSearchParams(
        globalThis.location.hash.slice(1),
      );
      const hashError = hashParameters.get("error");
      const hashDescription = hashParameters.get("error_description");

      if (hashError) {
        toast.error(t("title"), {
          description:
            hashDescription?.replaceAll("+", " ") || t("defaultMessage"),
        });

        // Clear hash
        globalThis.history.replaceState(
          null,
          "",
          globalThis.location.pathname + globalThis.location.search,
        );
      }
    }
  }, [searchParameters, t]);

  return null;
}

/**
 *
 */
export function AuthErrorWatcher() {
  return (
    <Suspense fallback={null}>
      <AuthErrorWatcherInner />
    </Suspense>
  );
}
