/**
 * ESLint Report Runner & Parser
 * Runs ESLint, saves JSON report, and prints organized output grouped by file.
 * Usage: node scripts/lint-report.js [--no-tests]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { printLintSummary } = require('./parse-eslint');

const skipTests = process.argv.includes('--no-tests');
const reportsDir = path.join(process.cwd(), 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

const LINT_REPORT = path.join(reportsDir, 'eslint.json');
const TEXT_REPORT = path.join(reportsDir, 'eslint-summary.txt');

// Build ESLint command
let eslintCmd = 'pnpm exec eslint . -f json';
if (skipTests) {
    // Basic glob-based ignore for common test paths
    // Note: depending on ESLint config, you might need to adjust these
    eslintCmd += ' --ignore-pattern "**/tests/**" --ignore-pattern "**/e2e/**" --ignore-pattern "**/*.test.ts" --ignore-pattern "**/*.spec.ts"';
}

console.log(`🏃 Running ESLint${skipTests ? ' (skipping tests)' : ''}...`);

try {
    const output = execSync(eslintCmd, {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    fs.writeFileSync(LINT_REPORT, output);
} catch (error) {
    const output = (error.stdout || '') + (error.stderr ? '\n' + error.stderr : '');
    fs.writeFileSync(LINT_REPORT, output);
}

printLintSummary(LINT_REPORT, { outputFile: TEXT_REPORT });
console.log(`\n📄 Summary saved to: ${path.relative(process.cwd(), TEXT_REPORT)}`);
