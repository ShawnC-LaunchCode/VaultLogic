const fs = require('fs');

// Read the AIService file
const filePath = 'server/services/AIService.ts';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Define the methods to remove (with their approximate start lines for verification)
const methodsToRemove = [
  'buildWorkflowGenerationPrompt',
  'buildWorkflowSuggestionPrompt',
  'buildBindingSuggestionPrompt',
  'buildValueSuggestionPrompt',
  'buildWorkflowRevisionPrompt',
  'buildLogicGenerationPrompt',
  'buildLogicDebugPrompt',
  'buildLogicVisualizationPrompt'
];

let newLines = [];
let skip = false;
let skippedMethods = [];
let currentMethod = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Check if we're starting a method to remove
  for (const method of methodsToRemove) {
    if (line.includes(`private ${method}(`)) {
      skip = true;
      currentMethod = method;
      // Also remove the JSDoc comment (previous 3 lines if they're comments)
      let commentStart = i;
      while (commentStart > 0 && (lines[commentStart - 1].trim().startsWith('*') || lines[commentStart - 1].trim().startsWith('/**') || lines[commentStart - 1].trim() === '')) {
        commentStart--;
        if (lines[commentStart].trim().startsWith('/**')) break;
      }
      // Remove lines from commentStart to current
      newLines = newLines.slice(0, -(i - commentStart));
      break;
    }
  }
  
  // Check if we're at the end of a skipped method (closing brace at same indentation)
  if (skip && line.trim() === '}' && lines[i-1] && !lines[i-1].trim().startsWith('return')) {
    skip = false;
    skippedMethods.push(currentMethod);
    currentMethod = null;
    continue; // Skip the closing brace too
  }
  
  if (!skip) {
    newLines.push(line);
  }
}

console.log('Removed methods:', skippedMethods);
console.log(`Original lines: ${lines.length}`);
console.log(`New lines: ${newLines.length}`);
console.log(`Removed: ${lines.length - newLines.length} lines`);

// Write the new content
fs.writeFileSync(filePath, newLines.join('\n'));
console.log('✓ File updated successfully');
