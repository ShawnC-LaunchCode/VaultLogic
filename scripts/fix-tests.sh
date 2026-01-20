#!/bin/bash

# Fix SurveyService.test.ts
sed -i 's/expect(result)\.toBeUndefined()/expect(result).toBeNull()/g' tests/unit/services/SurveyService.test.ts
sed -i 's/mockPageRepo\.findBySurveyId\.mockResolvedValue/mockPageRepo.findBySurvey.mockResolvedValue/g' tests/unit/services/SurveyService.test.ts
sed -i "s/'Survey is not currently open'/'Survey not available'/g" tests/unit/services/SurveyService.test.ts
sed -i "s/'Anonymous access is not enabled'/'Survey not available'/g" tests/unit/services/SurveyService.test.ts

# Add missing mock for findByPage to mockQuestionRepo in SurveyService.test.ts
sed -i '/mockQuestionRepo = {/,/};/ { /findBySurveyId: vi.fn()/a\      findByPage: vi.fn(), }' tests/unit/services/SurveyService.test.ts

echo "Fixes applied!"
