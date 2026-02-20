const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.join(__dirname, '../reports/audit-report.md');
const JSON_PATH = path.join(__dirname, '../reports/audit.json');

// Ensure reports directory exists
if (!fs.existsSync(path.dirname(REPORT_PATH))) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
}

function parseAudit(jsonStr) {
    try {
        const d = JSON.parse(jsonStr);
        const advisories = d.advisories || {};
        const metadata = d.metadata || {};

        let report = `# Security Audit Report\n\n`;
        report += `Generated on: ${new Date().toISOString()}\n\n`;
        report += `## Summary\n\n`;
        report += `- **Critical:** ${metadata.vulnerabilities?.critical || 0}\n`;
        report += `- **High:** ${metadata.vulnerabilities?.high || 0}\n`;
        report += `- **Moderate:** ${metadata.vulnerabilities?.moderate || 0}\n`;
        report += `- **Low:** ${metadata.vulnerabilities?.low || 0}\n\n`;

        const highRisk = Object.values(advisories).filter(a => a.severity === 'high' || a.severity === 'critical');

        if (highRisk.length > 0) {
            report += `## High/Critical Vulnerabilities\n\n`;
            highRisk.forEach(a => {
                report += `### [${a.severity.toUpperCase()}] ${a.module_name}\n`;
                report += `- **Title:** ${a.title}\n`;
                report += `- **Dependency:** ${a.module_name}\n`;
                report += `- **Recommendation:** ${a.recommendation}\n`;
                report += `- **Paths:** ${(a.findings || []).map(f => f.paths?.join(' > ')).join(', ')}\n\n`;
            });
        } else {
            report += `✅ No High or Critical vulnerabilities found.\n\n`;
        }

        fs.writeFileSync(REPORT_PATH, report);
        fs.writeFileSync(JSON_PATH, jsonStr);

        console.log(`Audit report generated: ${REPORT_PATH}`);

        if (highRisk.length > 0) {
            console.error(`Found ${highRisk.length} high priority vulnerabilities!`);
            process.exit(1);
        }
    } catch (e) {
        console.error('Error parsing audit output:', e);
        fs.writeFileSync(REPORT_PATH, `# Security Audit Error\n\nCould not parse audit output.\n\n\`\`\`\n${jsonStr.slice(0, 1000)}\n\`\`\``);
        process.exit(1);
    }
}

console.log('Running pnpm audit...');
try {
    const out = execSync('pnpm audit --json', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    parseAudit(out);
} catch (e) {
    // pnpm audit exits with code 1 when vulnerabilities are found
    if (e.stdout) {
        parseAudit(e.stdout.toString());
    } else {
        console.error('Audit command failed without stdout:', e.message);
        process.exit(1);
    }
}
