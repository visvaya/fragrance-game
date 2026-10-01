// Prints the category scores from a Lighthouse JSON report.
// Usage: node scripts/parse-lighthouse.mjs [path]; defaults to reports/latest.report.json.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_REPORT_PATH = "reports/latest.report.json";
const CATEGORIES = [
  ["performance", "Performance"],
  ["accessibility", "Accessibility"],
  ["best-practices", "Best Practices"],
  ["seo", "SEO"],
];

const reportPath = resolve(process.cwd(), process.argv[2] ?? DEFAULT_REPORT_PATH);

try {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  for (const [key, label] of CATEGORIES) {
    const score = report.categories?.[key]?.score;
    console.log(`${label}: ${typeof score === "number" ? Math.round(score * 100) : "n/a"}`);
  }
} catch (error) {
  console.error(`Cannot read Lighthouse report ${reportPath}: ${error.message}`);
  process.exit(1);
}
