/**
 * Quality Audit Script
 * Runs all quality checks, saves reports to /reports, then prints a human-readable summary.
 * Usage: node scripts/quality.js [--no-tests]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { printLintSummary } = require('./parse-eslint');

const skipTests = process.argv.includes('--no-tests');
const reportsDir = path.join(process.cwd(), 'reports');
const LINT_REPORT = path.join(reportsDir, 'eslint.json');
const TEXT_REPORT = path.join(reportsDir, 'quality-summary.txt');

let outputLog = "";
const log = (msg) => {
    console.log(msg);
    outputLog += msg + "\n";
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function run(name, command, outputFile) {
    console.log(`\n[${name.toUpperCase()}] ${command}`);
    try {
        const output = execSync(command, { // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
            encoding: 'utf8',
            maxBuffer: 50 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        fs.writeFileSync(outputFile, output);
        console.log(`  ✅ No issues found.`);
        return true;
    } catch (error) {
        const output = (error.stdout || '') + (error.stderr ? '\n' + error.stderr : '');
        fs.writeFileSync(outputFile, output);
        console.log(`  ⚠️  Issues found – saved to ${path.basename(outputFile)}`);
        return false;
    }
}

// ── Typecheck Summary ─────────────────────────────────────────────────────────

function printTypecheckSummary(reportPath) {
    if (!fs.existsSync(reportPath)) return;
    const content = fs.readFileSync(reportPath, 'utf8').trim();
    if (!content) {
        log(`  ✅ No type errors!`);
        return;
    }
    const lines = content.split('\n').filter(Boolean);
    log(`\n  ┌─ TYPE ERRORS (${lines.length}) ─────────────────────────────────────────┐`);
    lines.slice(0, 20).forEach(line => log(`  │ ${line.trim()}`));
    if (lines.length > 20) log(`  │ ... and ${lines.length - 20} more`);
    log(`  └──────────────────────────────────────────────────────────────────┘`);
}

// ── Knip Summary ──────────────────────────────────────────────────────────────

function printKnipSummary(reportPath) {
    if (!fs.existsSync(reportPath)) return;
    let data;
    try {
        const raw = fs.readFileSync(reportPath, 'utf8');
        const jsonStart = raw.indexOf('{');
        if (jsonStart === -1) { log('  ⚠️  Could not parse knip.json'); return; }
        data = JSON.parse(raw.slice(jsonStart));
    } catch {
        log('  ⚠️  Could not parse knip.json'); return;
    }
    const issueCount = (data.issues || []).reduce((s, f) => {
        return s + Object.keys(f).filter(k => k !== 'file').reduce((sum, key) => {
            return sum + (Array.isArray(f[key]) ? f[key].length : Object.keys(f[key] || {}).length);
        }, 0);
    }, 0);
    const fileCount = (data.files || []).length;
    if (issueCount === 0 && fileCount === 0) {
        log(`  ✅ No dead code found!`);
    } else {
        if (fileCount > 0) log(`  ⚠️  ${fileCount} unused file(s)`);
        if (issueCount > 0) log(`  ⚠️  ${issueCount} unused export(s)/binding(s)`);

        // Print specific issues
        (data.issues || []).forEach(issue => {
            Object.keys(issue).filter(k => k !== 'file').forEach(category => {
                const items = issue[category];
                if (Array.isArray(items) && items.length > 0) {
                    items.forEach(item => {
                        const name = item.name || String(item);
                        const line = item.line ? `:${item.line}` : '';
                        log(`      - [${category}] ${name} in ${issue.file}${line}`);
                    });
                } else if (!Array.isArray(items) && items && Object.keys(items).length > 0) {
                    Object.keys(items).forEach(key => {
                        log(`      - [${category}] ${key} in ${issue.file}`);
                    });
                }
            });
        });
    }
}

// ── Depcheck Summary ────────────────────────────────────────────────────────────

function printDepcheckSummary(reportPath) {
    if (!fs.existsSync(reportPath)) return;
    let data;
    try {
        data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch {
        const raw = fs.readFileSync(reportPath, 'utf8').trim();
        if (raw) {
            log('  ⚠️  Depcheck tool crashed or returned invalid JSON. Raw output:');
            const lines = raw.split('\n');
            lines.slice(0, 5).forEach(line => log(`    ${line}`));
            if (lines.length > 5) log(`    ... and ${lines.length - 5} more lines`);
        } else {
            log('  ⚠️  Could not parse depcheck.json (empty output)');
        }
        return;
    }

    let hasIssues = false;
    if (data.dependencies && data.dependencies.length > 0) {
        log(`\n  ┌─ UNUSED DEPENDENCIES (${data.dependencies.length}) ─────────┐`);
        data.dependencies.forEach(dep => log(`  │ ${dep}`));
        log(`  └──────────────────────────────────────┘`);
        hasIssues = true;
    }
    if (data.devDependencies && data.devDependencies.length > 0) {
        log(`\n  ┌─ UNUSED DEV-DEPENDENCIES (${data.devDependencies.length}) ─┐`);
        data.devDependencies.forEach(dep => log(`  │ ${dep}`));
        log(`  └──────────────────────────────────────┘`);
        hasIssues = true;
    }
    if (data.missing && Object.keys(data.missing).length > 0) {
        const missingKeys = Object.keys(data.missing);
        log(`\n  ┌─ MISSING DEPENDENCIES (${missingKeys.length}) ─────────┐`);
        missingKeys.forEach(dep => log(`  │ ${dep}`));
        log(`  └──────────────────────────────────────┘`);
        hasIssues = true;
    }

    if (!hasIssues) {
        log('  ✅ No unused or missing dependencies!');
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const LINE = '═'.repeat(70);

log(`\n${LINE}`);
log(`  🚀  QUALITY AUDIT  –  ${new Date().toLocaleTimeString('pl-PL')}`);
if (skipTests) log(`  🧪  Excluding tests from audit`);
log(`${LINE}`);

ensureDir(reportsDir);

let lintCmd = 'pnpm exec eslint . -f json';

if (skipTests) {
    lintCmd += ' --ignore-pattern "**/tests/**" --ignore-pattern "**/__tests__/**" --ignore-pattern "**/e2e/**" --ignore-pattern "**/*.test.ts" --ignore-pattern "**/*.test.tsx" --ignore-pattern "**/*.spec.ts" --ignore-pattern "**/*.spec.tsx"';
}

const tools = [
    { name: 'typecheck', command: 'pnpm tsc --noEmit', file: 'typecheck.log' },
    { name: 'lint', command: lintCmd, file: t => 'eslint.json' },
    { name: 'format', command: 'pnpm prettier --check .', file: 'format.log' },
    { name: 'knip', command: 'pnpm knip --reporter json', file: 'knip.json' },
    { name: 'depcheck', command: 'pnpm exec depcheck --json', file: 'depcheck.json' },
];

const results = {};
for (const t of tools) {
    const filename = typeof t.file === 'function' ? t.file() : t.file;
    results[t.name] = run(t.name, t.command, path.join(reportsDir, filename));
}

// ── Summary Section ───────────────────────────────────────────────────────────

log(`\n${LINE}`);
log(`  📊  SUMMARY`);
log(`${LINE}`);

log('\n[TYPECHECK]');
printTypecheckSummary(path.join(reportsDir, 'typecheck.log'));

log('\n[ESLINT]');
// We capture printLintSummary output into our log
const oldLog = console.log;
console.log = (m) => { outputLog += m + "\n"; oldLog(m); };
printLintSummary(LINT_REPORT);
console.log = oldLog;

log('\n[KNIP]');
printKnipSummary(path.join(reportsDir, 'knip.json'));

log('\n[DEPCHECK]');
printDepcheckSummary(path.join(reportsDir, 'depcheck.json'));

log('\n[PRETTIER]');
if (results.format) {
    log('  ✅ All files correctly formatted!');
} else {
    const formatLogPath = path.join(reportsDir, 'format.log');
    if (fs.existsSync(formatLogPath)) {
        const fmt = fs.readFileSync(formatLogPath, 'utf8').trim();
        const cleanFmt = fmt.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        const lines = cleanFmt.split('\n');
        const bad = lines.filter(l => l.includes('[warn]') && !l.includes('issues found'));
        const adviceLine = lines.find(l => l.toLowerCase().includes('run prettier with --write'));

        if (bad.length === 0) {
            log('  ⚠️  Prettier failed but no specific unformatted files listed.');
        } else {
            bad.slice(0, 10).forEach(l => log(`  ⚠️  ${l.trim()}`));
            if (bad.length > 10) log(`  │ ... and ${bad.length - 10} more formatting issues`);

            let advice = adviceLine ? adviceLine.trim() : `Code style issues found in ${bad.length} files. Run 'pnpm prettier --write .' to fix.`;
            advice = advice.replace('[warn]', '').trim();
            log(`\n  💡 Tip: ${advice}`);
        }
    }
}

const allClean = Object.values(results).every(Boolean);
log(`\n${LINE}`);
log(allClean
    ? `  🎉  All checks passed! Project is clean.`
    : `  ⚠️  Some checks reported issues. See /reports for details.`
);
log(`${LINE}\n`);

// Save total summary to text file for LLM
fs.writeFileSync(TEXT_REPORT, outputLog.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, ''));
log(`📄 Full state summary saved to: ${path.relative(process.cwd(), TEXT_REPORT)}`);
