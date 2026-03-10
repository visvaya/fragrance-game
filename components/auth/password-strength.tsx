"use client";

import { useTranslations } from "next-intl";

type PasswordStrengthProperties = {
  password?: string;
};

/**
 * Component to display password strength and requirements checklist.
 */
export function PasswordStrength({
  password = "",
}: Readonly<PasswordStrengthProperties>) {
  const t = useTranslations("Auth.passwordStrength");
  const checks = {
    hasMinLength: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^a-z0-9]/i.test(password),
    uppercase: /[A-Z]/.test(password),
  };

  const strength = [
    checks.hasMinLength,
    checks.lowercase,
    checks.uppercase,
    checks.number,
    checks.special,
  ].filter(Boolean).length;

  if (!password) return null;

  const getColor = () => {
    if (strength <= 2) return "bg-destructive";
    if (strength <= 3) return "bg-yellow-500";
    if (strength <= 4) return "bg-blue-500";
    return "bg-green-500";
  };

  const getLabel = () => {
    if (strength <= 2) return t("weak");
    if (strength <= 3) return t("medium");
    if (strength <= 4) return t("strong");
    return t("veryStrong");
  };

  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${Math.max((strength / 5) * 100, 5)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{getLabel()}</p>

      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
        <p className={checks.hasMinLength ? "text-green-500" : ""}>
          {checks.hasMinLength ? "✓" : "○"} {t("minChars")}
        </p>
        <p className={checks.lowercase ? "text-green-500" : ""}>
          {checks.lowercase ? "✓" : "○"} {t("lowercase")}
        </p>
        <p className={checks.uppercase ? "text-green-500" : ""}>
          {checks.uppercase ? "✓" : "○"} {t("uppercase")}
        </p>
        <p className={checks.number ? "text-green-500" : ""}>
          {checks.number ? "✓" : "○"} {t("number")}
        </p>
        <p className={checks.special ? "text-green-500" : ""}>
          {checks.special ? "✓" : "○"} {t("special")}
        </p>
      </div>
    </div>
  );
}
