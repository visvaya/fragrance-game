import { useTranslations } from "next-intl";

/**
 *
 * @param root0
 * @param root0.score
 */
export function DifficultyDisplay({ score }: { score: number }) {
  const t = useTranslations("Difficulty");
  // Based on DB percentiles: p80=0.58, p60=0.51, p40=0.43, p20=0.35
  const getDifficulty = (s: number) => {
    if (s >= 0.58) return { label: t("expert"), stars: 5 };
    if (s >= 0.51) return { label: t("hard"), stars: 4 };
    if (s >= 0.43) return { label: t("medium"), stars: 3 };
    if (s >= 0.35) return { label: t("easy"), stars: 2 };
    return { label: t("beginner"), stars: 1 };
  };

  const { label, stars } = getDifficulty(score);

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
