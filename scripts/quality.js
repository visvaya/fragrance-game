/**
 * Quality Audit Script
 * Runs all quality checks, saves reports to /reports, then prints a human-readable summary.
 * Usage: node scripts/quality.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const reportsDir = path.join(process.cwd(), 'reports');
const LINT_REPORT = path.join(reportsDir, 'eslint.json');

// ── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function run(name, command, outputFile) {
    console.log(`\n[${name.toUpperCase()}] ${command}`);
    try {
        const output = execSync(command, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
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

// ── ESLint Summary ────────────────────────────────────────────────────────────

function printLintSummary(reportPath) {
    if (!fs.existsSync(reportPath)) return;

    let data;
    try {
        data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch {
        console.log('  ⚠️  Could not parse eslint.json');
        return;
    }

    const errors = {};
    const warnings = {};
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalFiles = 0;

    for (const file of data) {
        if (file.messages.length === 0) continue;
        totalFiles++;
        for (const msg of file.messages) {
            const rule = msg.ruleId || '(parse error)';
            if (msg.severity === 2) {
                errors[rule] = (errors[rule] || 0) + 1;
                totalErrors++;
            } else {
                warnings[rule] = (warnings[rule] || 0) + 1;
                totalWarnings++;
            }
        }
    }

    const pad = (n) => n.toString().padStart(5);

    if (totalErrors > 0) {
        console.log(`\n  ┌─ ERRORS (${totalErrors} in ${totalFiles} files) ──────────────────────┐`);
        Object.entries(errors)
            .sort((a, b) => b[1] - a[1])
            .forEach(([rule, count]) =>
                console.log(`  │ ${pad(count)}  ${rule}`)
            );
        console.log(`  └──────────────────────────────────────────────────────────────────┘`);
    } else {
        console.log(`  ✅ No errors!`);
    }

    if (totalWarnings > 0) {
        console.log(`\n  ┌─ WARNINGS (${totalWarnings}) ──────────────────────────────────────────┐`);
        Object.entries(warnings)
            .sort((a, b) => b[1] - a[1])
            .forEach(([rule, count]) =>
                console.log(`  │ ${pad(count)}  ${rule}`)
            );
        console.log(`  └──────────────────────────────────────────────────────────────────┘`);
    }
}

// ── Typecheck Summary ─────────────────────────────────────────────────────────

function printTypecheckSummary(reportPath) {
    if (!fs.existsSync(reportPath)) return;
    const content = fs.readFileSync(reportPath, 'utf8').trim();
    if (!content) {
        console.log(`  ✅ No type errors!`);
        return;
    }
    const lines = content.split('\n').filter(Boolean);
    console.log(`\n  ┌─ TYPE ERRORS (${lines.length}) ─────────────────────────────────────────┐`);
    lines.slice(0, 20).forEach(line => console.log(`  │ ${line.trim()}`));
    if (lines.length > 20) console.log(`  │ ... and ${lines.length - 20} more`);
    console.log(`  └──────────────────────────────────────────────────────────────────┘`);
}

// ── Knip Summary ──────────────────────────────────────────────────────────────

function printKnipSummary(reportPath) {
    if (!fs.existsSync(reportPath)) return;
    let data;
    try {
        data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch {
        // Output may include non-JSON text (e.g. Knip warnings on stderr)
        const raw = fs.readFileSync(reportPath, 'utf8');
        const jsonStart = raw.indexOf('{');
        if (jsonStart === -1) { console.log('  ⚠️  Could not parse knip.json'); return; }
        try { data = JSON.parse(raw.slice(jsonStart)); } catch { return; }
    }
    const issueCount = (data.issues || []).reduce((s, f) => s + Object.keys(f).filter(k => k !== 'file').length, 0);
    const fileCount = (data.files || []).length;
    if (issueCount === 0 && fileCount === 0) {
        console.log(`  ✅ No dead code found!`);
    } else {
        if (fileCount > 0) console.log(`  ⚠️  ${fileCount} unused file(s)`);
        if (issueCount > 0) console.log(`  ⚠️  ${issueCount} unused export(s)/binding(s)`);
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const LINE = '═'.repeat(70);

console.log(`\n${LINE}`);
console.log(`  🚀  QUALITY AUDIT  –  ${new Date().toLocaleTimeString('pl-PL')}`);
console.log(`${LINE}`);

ensureDir(reportsDir);

const tools = [
    { name: 'typecheck', command: 'pnpm tsc --noEmit', file: 'typecheck.log' },
    { name: 'lint', command: 'pnpm eslint . -f json', file: 'eslint.json' },
    { name: 'format', command: 'pnpm prettier --check .', file: 'format.log' },
    { name: 'knip', command: 'pnpm knip --reporter json', file: 'knip.json' },
    { name: 'depcheck', command: 'pnpm exec depcheck --json', file: 'depcheck.json' },
];

const results = {};
for (const t of tools) {
    results[t.name] = run(t.name, t.command, path.join(reportsDir, t.file));
}

// ── Summary Section ───────────────────────────────────────────────────────────

console.log(`\n${LINE}`);
console.log(`  📊  SUMMARY`);
console.log(`${LINE}`);

console.log('\n[TYPECHECK]');
printTypecheckSummary(path.join(reportsDir, 'typecheck.log'));

console.log('\n[ESLINT]');
printLintSummary(LINT_REPORT);

console.log('\n[KNIP]');
printKnipSummary(path.join(reportsDir, 'knip.json'));

console.log('\n[DEPCHECK]');
if (results.depcheck) {
    console.log('  ✅ No unused dependencies!');
} else {
    console.log('  ⚠️  See reports/depcheck.json for details');
}

console.log('\n[PRETTIER]');
if (results.format) {
    console.log('  ✅ All files correctly formatted!');
} else {
    const fmt = fs.readFileSync(path.join(reportsDir, 'format.log'), 'utf8').trim();
    const bad = fmt.split('\n').filter(l => l.includes('[warn]') && !l.includes('issues found'));
    bad.forEach(l => console.log(`  ⚠️  ${l.trim()}`));
}

const allClean = Object.values(results).every(Boolean);
console.log(`\n${LINE}`);
console.log(allClean
    ? `  🎉  All checks passed! Project is clean.`
    : `  ⚠️  Some checks reported issues. See /reports for details.`
);
console.log(`${LINE}\n`);
