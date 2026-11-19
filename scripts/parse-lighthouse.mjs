// Prints the category scores from a Lighthouse JSON report.
// Usage: node scripts/parse-lighthouse.mjs [path]; defaults to reports/latest.report.json.
import { readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_REPORT_PATH = "reports/latest.report.json";
const CATEGORIES = {
  performance: "Performance",
  accessibility: "Accessibility",
  "best-practices": "Best Practices",
  seo: "SEO",
};

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === "object" && value !== null;

/** @returns {unknown} */
const readReport = () => JSON.parse(readFileSync(reportPath, "utf8"));

const reportPath = path.resolve(process.cwd(), process.argv[2] ?? DEFAULT_REPORT_PATH);

try {
  const report = readReport();
  const categories = isRecord(report) && isRecord(report.categories) ? report.categories : {};
  for (const [key, label] of Object.entries(CATEGORIES)) {
    const category = categories[key];
    const score = isRecord(category) ? category.score : undefined;
    console.log(`${label}: ${typeof score === "number" ? String(Math.round(score * 100)) : "n/a"}`);
  }
} catch (error) {
  console.error(`Cannot read Lighthouse report ${reportPath}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
