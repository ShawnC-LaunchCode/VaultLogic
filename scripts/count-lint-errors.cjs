const fs = require('fs');

try {
    const report = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));
    let misused = 0;
    let floating = 0;
    let total = 0;

    report.forEach(file => {
        file.messages.forEach(msg => {
            total++;
            if (msg.ruleId === '@typescript-eslint/no-floating-promises') floating++;
            if (msg.ruleId === '@typescript-eslint/no-misused-promises') misused++;
        });
    });

    console.log(`Total Errors: ${total}`);
    console.log(`Floating Promises: ${floating}`);
    console.log(`Misused Promises: ${misused}`);

} catch (e) {
    console.error("Error parsing report:", e);
}
