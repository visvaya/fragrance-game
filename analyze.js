const f = require('./lighthouse-report.json');
console.log('=== LIGHTHOUSE SCORES ===');
console.log('Performance:', Math.round(f.categories.performance.score * 100));
console.log('Accessibility:', Math.round(f.categories.accessibility.score * 100));
console.log('Best Practices:', Math.round(f.categories['best-practices'].score * 100));
console.log('SEO:', Math.round(f.categories.seo.score * 100));
console.log('\n=== CORE WEB VITALS ===');
console.log('LCP:', f.audits['largest-contentful-paint'].displayValue);
console.log('INP:', f.audits['interaction-to-next-paint'].displayValue);
console.log('CLS:', f.audits['cumulative-layout-shift'].displayValue);
console.log('\n=== TOP OPPORTUNITIES ===');
Object.entries(f.audits)
  .filter(([k,v]) => v.details?.type === 'opportunity' && v.details?.overallSavingsMs)
  .sort((a,b) => b[1].details.overallSavingsMs - a[1].details.overallSavingsMs)
  .slice(0, 10)
  .forEach(([k,v]) => {
    const savings = v.details.overallSavingsBytes ? ` (${Math.round(v.details.overallSavingsBytes/1024)}KB)` : '';
    console.log(`- ${v.title}: -${Math.round(v.details.overallSavingsMs)}ms${savings}`);
  });
