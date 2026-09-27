/**
 * Quality Audit Script
 * Runs all quality checks, saves reports to /reports, then prints a human-readable summary.
 *
 * Checks:
 *   1. TypeScript  – zero type errors (tsc --noEmit)
 *   2. ESLint      – static analysis (max-warnings=0 in CI)
 *   3. Prettier    – consistent formatting
 *   4. Knip        – dead exports / unused files
 *   5. Depcheck    – unused / missing npm dependencies
 *   6. JSCPD       – copy-paste / code duplication (threshold 5%)
 *   7. Madge       – circular dependency graph
 *   8. Depcruise   – architectural rule violations (.dependency-cruiser.js)
 *   9. Type-Coverage – % of typed nodes vs `any` (min 95%)
 *  10. PNPM Audit  – known security vulnerabilities (CVE)
 *
 * Usage:
 *   node scripts/quality.js            – full audit
 *   node scripts/quality.js --no-tests – skip test files from lint
 *   node scripts/quality.js --fast     – skip slow checks (depcruise, type-coverage)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { printLintSummary } = require('./parse-eslint');

const skipTests = process.argv.includes('--no-tests');
const fastMode  = process.argv.includes('--fast');

const reportsDir   = path.join(process.cwd(), 'reports');
const LINT_REPORT  = path.join(reportsDir, 'eslint.json');
const TEXT_REPORT  = path.join(reportsDir, 'quality-summary.txt');

let outputLog = '';
const log = (msg) => {
  console.log(msg);
  outputLog += msg + '\n';
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Runs a shell command, saves its stdout+stderr to `outputFile`, returns success. */
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

// ── Section Printers ─────────────────────────────────────────────────────────

function printTypecheckSummary(reportPath) {
  if (!fs.existsSync(reportPath)) return;
  const content = fs.readFileSync(reportPath, 'utf8').trim();
  if (!content) {
    log(`  ✅ No type errors!`);
    return;
  }
  const lines = content.split('\n').filter(Boolean);
  log(`\n  ┌─ TYPE ERRORS (${lines.length}) ──────────────────────────────────────────┐`);
  lines.slice(0, 20).forEach(line => log(`  │ ${line.trim()}`));
  if (lines.length > 20) log(`  │ ... and ${lines.length - 20} more`);
  log(`  └──────────────────────────────────────────────────────────────────┘`);
}

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
  if (!hasIssues) log('  ✅ No unused or missing dependencies!');
}

function printJscpdSummary(reportDir) {
  const reportFile = path.join(reportDir, 'jscpd-report.json');
  if (!fs.existsSync(reportFile)) {
    log('  ⚠️  JSCPD report not found.');
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  } catch {
    log('  ⚠️  Could not parse jscpd report.'); return;
  }

  const stats = data.statistics;
  if (!stats) { log('  ⚠️  JSCPD report missing statistics.'); return; }

  const total   = stats.total || {};
  const pct     = parseFloat(total.percentage || 0);
  const clones  = total.clones || 0;
  const duped   = total.duplicatedLines || 0;
  const THRESHOLD = 5;

  if (pct <= THRESHOLD && clones === 0) {
    log(`  ✅ No significant duplication detected! (${pct.toFixed(2)}% of lines)`);
    return;
  }

  const icon = pct > THRESHOLD ? '🔴' : '🟡';
  log(`  ${icon} Duplication: ${pct.toFixed(2)}% (${duped} lines across ${clones} clone groups) [threshold: ${THRESHOLD}%]`);

  const duplicates = data.duplicates || [];
  const top = duplicates.slice(0, 5);
  if (top.length > 0) {
    log(`\n  ┌─ TOP DUPLICATE BLOCKS ─────────────────────────────────────────┐`);
    top.forEach((d, i) => {
      const a = d.firstFile  ? `${path.relative(process.cwd(), d.firstFile.name)}:${d.firstFile.start}` : '?';
      const b = d.secondFile ? `${path.relative(process.cwd(), d.secondFile.name)}:${d.secondFile.start}` : '?';
      log(`  │ ${i + 1}. ${a}`);
      log(`  │    ↔ ${b}  (${d.lines} lines)`);
    });
    if (duplicates.length > 5) log(`  │ ... and ${duplicates.length - 5} more clone groups`);
    log(`  └──────────────────────────────────────────────────────────────────┘`);
  }
}

function printMadgeSummary(reportPath) {
  if (!fs.existsSync(reportPath)) {
    log('  ⚠️  Madge report not found.');
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    log('  ⚠️  Could not parse madge-circular.json.'); return;
  }

  // madge --circular --json returns an array of cycles
  if (!Array.isArray(data) || data.length === 0) {
    log(`  ✅ No circular dependencies detected!`);
    return;
  }

  log(`  🔴 ${data.length} circular dependency cycle(s) detected!`);
  log(`\n  ┌─ CIRCULAR DEPENDENCIES ─────────────────────────────────────────┐`);
  data.slice(0, 10).forEach((cycle, i) => {
    log(`  │ ${i + 1}. ${Array.isArray(cycle) ? cycle.join(' → ') : String(cycle)}`);
  });
  if (data.length > 10) log(`  │ ... and ${data.length - 10} more cycles`);
  log(`  └──────────────────────────────────────────────────────────────────┘`);
}

function printDepcruiseSummary(reportPath) {
  if (!fs.existsSync(reportPath)) {
    log('  ⚠️  Dependency Cruiser report not found.');
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    const raw = fs.readFileSync(reportPath, 'utf8').trim();
    if (raw) {
      log('  ⚠️  Depcruise error:');
      raw.split('\n').slice(0, 5).forEach(l => log(`    ${l}`));
    }
    return;
  }

  const modules = data.modules || [];
  const violations = [];

  for (const mod of modules) {
    for (const dep of (mod.dependencies || [])) {
      for (const rule of (dep.rules || [])) {
        if (rule.severity === 'error' || rule.severity === 'warn') {
          violations.push({ from: mod.source, to: dep.resolved, rule: rule.name, severity: rule.severity });
        }
      }
    }
  }

  if (violations.length === 0) {
    log(`  ✅ No architectural violations detected!`);
    return;
  }

  const errors = violations.filter(v => v.severity === 'error');
  const warns  = violations.filter(v => v.severity === 'warn');

  log(`  ${errors.length > 0 ? '🔴' : '🟡'} ${errors.length} error(s), ${warns.length} warning(s) in dependency rules`);
  log(`\n  ┌─ ARCHITECTURAL VIOLATIONS ──────────────────────────────────────┐`);
  violations.slice(0, 15).forEach(v => {
    const icon = v.severity === 'error' ? '🔴 ERR ' : '🟡 WRN ';
    log(`  │ ${icon} [${v.rule}] ${v.from} → ${v.to}`);
  });
  if (violations.length > 15) log(`  │ ... and ${violations.length - 15} more violations`);
  log(`  └──────────────────────────────────────────────────────────────────┘`);
}

function printTypeCoverageSummary(reportPath) {
  if (!fs.existsSync(reportPath)) {
    log('  ⚠️  Type coverage report not found.');
    return;
  }
  const raw = fs.readFileSync(reportPath, 'utf8').trim();
  const MIN_COVERAGE = 95;

  // type-coverage output: "XX.XX% (typed/total)"
  const match = raw.match(/([\d.]+)%/);
  if (!match) {
    log(`  ⚠️  Could not parse type coverage output: ${raw.slice(0, 120)}`);
    return;
  }

  const pct = parseFloat(match[1]);
  if (pct >= MIN_COVERAGE) {
    log(`  ✅ Type coverage: ${pct.toFixed(2)}% (threshold: ${MIN_COVERAGE}%)`);
  } else {
    log(`  🔴 Type coverage too low: ${pct.toFixed(2)}% (required: ≥${MIN_COVERAGE}%)`);
    // Show uncovered lines from the detail report
    const lines = raw.split('\n').filter(l => l.includes(' any ') || l.includes(': any'));
    if (lines.length > 0) {
      log(`\n  ┌─ WEAKLY TYPED NODES (sample) ─────────────────────────────────┐`);
      lines.slice(0, 10).forEach(l => log(`  │ ${l.trim()}`));
      if (lines.length > 10) log(`  │ ... and ${lines.length - 10} more`);
      log(`  └──────────────────────────────────────────────────────────────────┘`);
    }
  }
}

function printAuditSummary(reportPath) {
  if (!fs.existsSync(reportPath)) {
    log('  ⚠️  Security audit report not found.');
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    const raw = fs.readFileSync(reportPath, 'utf8').trim();
    log(`  ⚠️  Could not parse audit report: ${raw.slice(0, 80)}`);
    return;
  }

  // pnpm audit --json format: { metadata: { vulnerabilities: { ... } } }
  const meta  = data.metadata || {};
  const vulns = meta.vulnerabilities || {};
  const total  = Object.values(vulns).reduce((a, b) => a + (b || 0), 0);

  if (total === 0) {
    log(`  ✅ No known vulnerabilities found!`);
    return;
  }

  const critical = vulns.critical || 0;
  const high     = vulns.high || 0;
  const moderate = vulns.moderate || 0;
  const low      = vulns.low || 0;
  const icon     = critical > 0 || high > 0 ? '🔴' : '🟡';

  log(`  ${icon} ${total} vulnerabilit${total === 1 ? 'y' : 'ies'} found:`);
  if (critical > 0) log(`       Critical: ${critical}`);
  if (high     > 0) log(`       High:     ${high}`);
  if (moderate > 0) log(`       Moderate: ${moderate}`);
  if (low      > 0) log(`       Low:      ${low}`);
  log(`\n  💡 Run 'pnpm audit --fix' to attempt automatic remediation.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const LINE = '═'.repeat(70);

log(`\n${LINE}`);
log(`  🚀  QUALITY AUDIT  –  ${new Date().toLocaleTimeString('pl-PL')}`);
if (skipTests) log(`  🧪  Excluding tests from audit`);
if (fastMode)  log(`  ⚡  Fast mode – skipping slow checks`);
log(`${LINE}`);

ensureDir(reportsDir);
ensureDir(path.join(reportsDir, 'jscpd'));

let lintCmd = 'pnpm exec eslint . -f json';
if (skipTests) {
  lintCmd += ' --ignore-pattern "**/tests/**" --ignore-pattern "**/__tests__/**" --ignore-pattern "**/e2e/**" --ignore-pattern "**/*.test.ts" --ignore-pattern "**/*.test.tsx" --ignore-pattern "**/*.spec.ts" --ignore-pattern "**/*.spec.tsx"';
}

// Source directories for Madge / Depcruise (skip test folders)
const SRC_DIRS = ['app', 'components', 'hooks', 'lib'].join(' ');

const tools = [
  {
    name: 'typecheck',
    command: 'pnpm tsc --noEmit',
    file: 'typecheck.log',
  },
  {
    name: 'lint',
    command: lintCmd,
    file: 'eslint.json',
  },
  {
    name: 'format',
    command: 'pnpm prettier --check .',
    file: 'format.log',
  },
  {
    name: 'knip',
    command: 'pnpm knip --reporter json',
    file: 'knip.json',
  },
  {
    name: 'depcheck',
    command: 'pnpm exec depcheck --json',
    file: 'depcheck.json',
  },
  {
    name: 'jscpd',
    // Config from .jscpdrc; output to reports/jscpd/
    command: `pnpm exec jscpd . --config .jscpdrc --output reports/jscpd --reporters json`,
    file: 'jscpd/jscpd.log',
  },
  {
    name: 'madge',
    command: `pnpm exec madge --circular --json --extensions ts,tsx ${SRC_DIRS}`,
    file: 'madge-circular.json',
  },
  ...(!fastMode ? [
    {
      name: 'depcruise',
      command: `pnpm exec depcruise ${SRC_DIRS} --config .dependency-cruiser.js --output-type json`,
      file: 'depcruise.json',
    },
    {
      name: 'type-coverage',
      command: `pnpm exec type-coverage --at-least 95 --detail --ignore-nested --ignore-as-assertion`,
      file: 'type-coverage.log',
    },
  ] : []),
  {
    name: 'audit',
    command: 'pnpm audit --json',
    file: 'audit.json',
  },
];

const results = {};
for (const t of tools) {
  results[t.name] = run(t.name, t.command, path.join(reportsDir, t.file));
}

// ── Summary Section ───────────────────────────────────────────────────────────

log(`\n${LINE}`);
log(`  📊  SUMMARY`);
log(`${LINE}`);

log('\n[TYPECHECK]');
printTypecheckSummary(path.join(reportsDir, 'typecheck.log'));

log('\n[ESLINT]');
const oldLog = console.log;
console.log = (m) => { outputLog += m + '\n'; oldLog(m); };
printLintSummary(LINT_REPORT);
console.log = oldLog;

log('\n[KNIP]');
printKnipSummary(path.join(reportsDir, 'knip.json'));

log('\n[DEPCHECK]');
printDepcheckSummary(path.join(reportsDir, 'depcheck.json'));

log('\n[JSCPD — Code Duplication]');
printJscpdSummary(path.join(reportsDir, 'jscpd'));

log('\n[MADGE — Circular Dependencies]');
printMadgeSummary(path.join(reportsDir, 'madge-circular.json'));

if (!fastMode) {
  log('\n[DEPCRUISE — Architectural Rules]');
  printDepcruiseSummary(path.join(reportsDir, 'depcruise.json'));

  log('\n[TYPE COVERAGE]');
  printTypeCoverageSummary(path.join(reportsDir, 'type-coverage.log'));
}

log('\n[PNPM AUDIT — Security]');
printAuditSummary(path.join(reportsDir, 'audit.json'));

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
      const advice = adviceLine
        ? adviceLine.replace('[warn]', '').trim()
        : `Code style issues found in ${bad.length} files. Run 'pnpm prettier --write .' to fix.`;
      log(`\n  💡 Tip: ${advice}`);
    }
  }
}

// ── Final Status ──────────────────────────────────────────────────────────────

const allClean = Object.values(results).every(Boolean);
log(`\n${LINE}`);
log(allClean
  ? `  🎉  All checks passed! Project is clean.`
  : `  ⚠️  Some checks reported issues. See /reports for details.`
);
log(`${LINE}\n`);

fs.writeFileSync(TEXT_REPORT, outputLog.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, ''));
log(`📄 Full state summary saved to: ${path.relative(process.cwd(), TEXT_REPORT)}`);
