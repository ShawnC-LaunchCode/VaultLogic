const fs = require('fs');

async function processReport() {
    try {
        const reportPath = process.argv[2] || 'eslint-report.json';
        if (!fs.existsSync(reportPath)) {
            console.error(`${reportPath} not found!`);
            return;
        }

        const content = fs.readFileSync(reportPath, 'utf8');
        const report = JSON.parse(content);

        const floatingPromisesFiles = new Set();
        const misusedPromisesFiles = new Set();

        report.forEach(fileResult => {
            const filePath = fileResult.filePath;
            fileResult.messages.forEach(msg => {
                if (msg.ruleId === '@typescript-eslint/no-floating-promises') {
                    floatingPromisesFiles.add(filePath);
                }
                if (msg.ruleId === '@typescript-eslint/no-misused-promises') {
                    misusedPromisesFiles.add(filePath);
                }
            });
        });

        const output = {
            floatingPromises: [...floatingPromisesFiles].sort(),
            misusedPromises: [...misusedPromisesFiles].sort()
        };

        fs.writeFileSync('lint-critical-files.json', JSON.stringify(output, null, 2));
        console.log(`Found ${output.floatingPromises.length} files with floating promises`);
        console.log(`Found ${output.misusedPromises.length} files with misused promises`);
        console.log('Written to lint-critical-files.json');

    } catch (e) {
        console.error('Error processing report:', e);
    }
}

processReport();
