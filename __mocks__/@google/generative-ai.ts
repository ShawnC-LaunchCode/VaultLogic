
import { vi } from 'vitest';

export const GoogleGenerativeAI = class MockGoogleGenerativeAI {
    constructor(apiKey: string) { }
    getGenerativeModel(params: any) {
        return {
            generateContent: vi.fn().mockResolvedValue({
                response: { text: () => JSON.stringify({}) }
            })
        };
    }
};
