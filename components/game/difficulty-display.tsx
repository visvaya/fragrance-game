import { useTranslations } from "next-intl";

/**
 *
 * @param root0
 * @param root0.score
 */
export function DifficultyDisplay({ score }: { score: number }) {
  const t = useTranslations("Difficulty");
  // Convert 0-1 to 1-5 stars
  const stars = Math.round(score * 5);
  // Based on DB percentiles: p80=0.58, p60=0.51, p40=0.43, p20=0.35
  const label =
    score >= 0.58
      ? t("expert")
      : score >= 0.51
        ? t("hard")
        : score >= 0.43
          ? t("medium")
          : score >= 0.35
            ? t("easy")
            : t("beginner");

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">
        {t("label")}
      </span>
      <div className="flex text-sm text-amber-500">
        {Array.from({ length: 5 }, (_, i) => (
          <span className={i < stars ? "opacity-100" : "opacity-20"} key={i}>
            ★
          </span>
        ))}
      </div>
      <span className="text-xs font-semibold text-foreground/80">{label}</span>
      {/* <span className="text-[10px] text-muted-foreground">({score.toFixed(2)})</span> */}
    </div>
  );
}
