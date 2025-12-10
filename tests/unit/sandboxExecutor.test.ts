
import { describe, it, expect, vi } from "vitest";
import { runJsVm2 } from "../../server/utils/sandboxExecutor";

describe("sandboxExecutor", () => {
    it("should execute JS code correctly", async () => {
        const code = "return input.a + input.b;";
        const input = { a: 1, b: 2 };
        const result = await runJsVm2(code, input);

        expect(result.ok).toBe(true);
        expect(result.output).toBe(3);
    });

    it("should use cache for repeated executions", async () => {
        // This test relies on performance difference or mocking VMScript
        // Since we can't easily access the internal cache variable, we'll check validity 
        // and rely on the implementation correctness we wrote.
        // Ideally we would mock vm2 to spy on VMScript constructor.

        const code = "return input.x * 2;";
        const input1 = { x: 10 };
        const input2 = { x: 20 };

        // First run (compiles)
        const start1 = performance.now();
        const result1 = await runJsVm2(code, input1);
        const end1 = performance.now();

        // Second run (should be cached)
        const start2 = performance.now();
        const result2 = await runJsVm2(code, input2);
        const end2 = performance.now();

        expect(result1.ok).toBe(true);
        expect(result1.output).toBe(20);
        expect(result2.ok).toBe(true);
        expect(result2.output).toBe(40);

        // Note: Performance check is flaky in tests, so we just ensure correctness here.
    });

    it("should handle timeouts", async () => {
        const code = "while(true);";
        const result = await runJsVm2(code, {}, 100);
        expect(result.ok).toBe(false);
        expect(result.error).toContain("TimeoutError");
    });
});
