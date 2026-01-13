const fs = require('fs');

const serverData = JSON.parse(fs.readFileSync('eslint-server-report.json', 'utf8'));
const clientData = JSON.parse(fs.readFileSync('eslint-client-report.json', 'utf8'));

const getTopRules = (data) => {
  const ruleCounts = {};
  data.forEach(file => {
    file.messages.forEach(msg => {
      if (msg.ruleId) {
        ruleCounts[msg.ruleId] = (ruleCounts[msg.ruleId] || 0) + 1;
      }
    });
  });
  return Object.entries(ruleCounts).sort((a,b) => b[1] - a[1]).slice(0, 15);
};

console.log('ESLint Baseline Report - January 13, 2026\n');
console.log('='.repeat(70));
console.log('\nSERVER DIRECTORY:');
console.log('  Files with issues:', serverData.filter(f => f.errorCount > 0 || f.warningCount > 0).length);
console.log('  Total errors:', serverData.reduce((sum, f) => sum + f.errorCount, 0));
console.log('  Total warnings:', serverData.reduce((sum, f) => sum + f.warningCount, 0));

console.log('\nCLIENT DIRECTORY:');
console.log('  Files with issues:', clientData.filter(f => f.errorCount > 0 || f.warningCount > 0).length);
console.log('  Total errors:', clientData.reduce((sum, f) => sum + f.errorCount, 0));
console.log('  Total warnings:', clientData.reduce((sum, f) => sum + f.warningCount, 0));

const combinedData = [...serverData, ...clientData];
const totalErrors = combinedData.reduce((sum, f) => sum + f.errorCount, 0);
const totalWarnings = combinedData.reduce((sum, f) => sum + f.warningCount, 0);

console.log('\n' + '='.repeat(70));
console.log('TOTAL ACROSS CODEBASE:');
console.log('  Files with issues:', combinedData.filter(f => f.errorCount > 0 || f.warningCount > 0).length);
console.log('  Total errors:', totalErrors);
console.log('  Total warnings:', totalWarnings);
console.log('  Total issues:', totalErrors + totalWarnings);

console.log('\n' + '='.repeat(70));
console.log('TOP 15 MOST COMMON ISSUES:\n');
const topRules = getTopRules(combinedData);
topRules.forEach(([rule, count], i) => {
  console.log('  ' + (i + 1) + '. ' + rule + ': ' + count + ' occurrences');
});

console.log('\n' + '='.repeat(70));
console.log('CONFIGURATION:');
console.log('  ESLint version: 8.57.1');
console.log('  Plugins: @typescript-eslint, react, react-hooks, import, security, sonarjs');
console.log('  TypeScript strict rules enabled');

console.log('\nNEXT STEPS:');
console.log('  1. Address high-priority errors (type safety, floating promises)');
console.log('  2. Auto-fix import ordering: npm run lint:fix');
console.log('  3. Gradually reduce rule violations with focused PRs');
console.log('  4. Set up pre-commit hooks to prevent new violations');
console.log('='.repeat(70));
