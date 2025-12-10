/**
 * Enhanced Sandbox Executor for Custom Scripting System
 * Extends sandboxExecutor.ts with helper library and context injection
 */

import { spawn } from "child_process";
import type { ScriptExecutionResult, ScriptContextAPI } from "@shared/types/scripting";
import { createHelperLibrary } from "../services/scripting/HelperLibrary";
import { createLogger } from "../logger";

const logger = createLogger({ module: "enhanced-sandbox" });

// Security Constants (Mirrored from sandboxExecutor)
const MAX_CODE_SIZE = parseInt(process.env.SANDBOX_MAX_CODE_SIZE || "32768", 10);
const MAX_INPUT_SIZE = parseInt(process.env.SANDBOX_MAX_INPUT_SIZE || "65536", 10);
const MAX_OUTPUT_SIZE = parseInt(process.env.SANDBOX_MAX_OUTPUT_SIZE || "65536", 10);
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 3000;

interface ExecuteCodeWithHelpersParams {
  language: "javascript" | "python";
  code: string;
  input: Record<string, unknown>;
  context: ScriptContextAPI;
  helpers?: Record<string, any>;
  timeoutMs?: number;
  consoleEnabled?: boolean;
}

/**
 * Execute JavaScript code with helpers and context injection
 */
async function runJsWithHelpers(
  code: string,
  input: Record<string, unknown>,
  context: ScriptContextAPI,
  helpers: Record<string, any>,
  timeoutMs: number,
  consoleEnabled: boolean
): Promise<ScriptExecutionResult> {
  try {
    // Enforce timeout limits
    const actualTimeout = Math.min(Math.max(timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);

    // Validate code size
    if (code.length > MAX_CODE_SIZE) {
      return {
        ok: false,
        error: `Code size exceeds ${MAX_CODE_SIZE / 1024}KB limit`,
      };
    }

    // Validate input size
    const inputJson = JSON.stringify(input);
    if (inputJson.length > MAX_INPUT_SIZE) {
      return {
        ok: false,
        error: `Input size exceeds ${MAX_INPUT_SIZE / 1024}KB limit`,
      };
    }

    // Create helper library with optional console capture
    const helperLib = createHelperLibrary({ consoleEnabled });
    const actualHelpers = helpers || helperLib.helpers;

    // Dynamically import vm2
    let VM2: any;
    try {
      const vm2Module = await import("vm2");
      VM2 = vm2Module.VM;
    } catch (importError) {
      logger.error({ error: importError }, "Failed to initialize vm2 sandbox in enhanced executor");
      return {
        ok: false,
        error: "SandboxInitializationError: Secure sandbox engine (vm2) is not available. Execution aborted for security.",
      };
    }

    // Create VM2 sandbox with restricted globals + helpers + context
    const vm = new VM2({
      timeout: actualTimeout,
      sandbox: {
        input,
        context,
        helpers: actualHelpers,
      },
      eval: false,
      wasm: false,
    });

    // Wrap code in a function and execute it
    const wrappedCode = `
      (function(input, context, helpers) {
        ${code}
      })(input, context, helpers);
    `;

    const startTime = Date.now();

    // Execute code and capture return value
    const result = vm.run(wrappedCode);

    const durationMs = Date.now() - startTime;

    return {
      ok: true,
      output: result as any,
      consoleLogs: helperLib.getConsoleLogs ? helperLib.getConsoleLogs() : undefined,
      durationMs,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Check for timeout
      if (error.message.includes("timeout") || error.message.includes("timed out")) {
        return {
          ok: false,
          error: "TimeoutError: Execution exceeded time limit",
        };
      }

      return {
        ok: false,
        error: `SandboxError: ${error.message}`,
      };
    }

    return {
      ok: false,
      error: "Unknown execution error",
    };
  }
}

/**
 * Execute Python code with helpers and context injection
 * Helpers are serialized as utility functions available in Python
 */
async function runPythonWithHelpers(
  code: string,
  input: Record<string, unknown>,
  context: ScriptContextAPI,
  timeoutMs: number,
  consoleEnabled: boolean
): Promise<ScriptExecutionResult> {
  return new Promise((resolve) => {
    try {
      // Enforce timeout limits
      const actualTimeout = Math.min(Math.max(timeoutMs, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);

      // Validate code size
      if (code.length > MAX_CODE_SIZE) {
        resolve({
          ok: false,
          error: `Code size exceeds ${MAX_CODE_SIZE / 1024}KB limit`,
        });
        return;
      }

      // Validate input size BEFORE combining with code to prevent DoS
      const inputJson = JSON.stringify(input);
      if (inputJson.length > MAX_INPUT_SIZE) {
        resolve({
          ok: false,
          error: `Input size exceeds ${MAX_INPUT_SIZE / 1024}KB limit. Size: ${inputJson.length} bytes.`,
        });
        return;
      }

      // Serialize context for Python
      const contextJson = JSON.stringify(context);

      // Prepare payload (Input + Code)
      const payload = {
        input,
        __sys_code__: code,
        __sys_context__: contextJson // Pass context string to be parsed in python
      };

      // Final combined size check (defense in depth)
      const payloadJson = JSON.stringify(payload);
      if (payloadJson.length > MAX_INPUT_SIZE + MAX_CODE_SIZE) {
        resolve({
          ok: false,
          error: `Combined payload size exceeds maximum allowed. Consider reducing input or code size.`,
        });
        return;
      }

      // Python wrapper script with helpers and context
      // Reads input, context, and code from stdin
      const pythonWrapper = `
import json
import sys
import math
from datetime import datetime, timedelta

# Restricted builtins - only safe operations allowed
safe_builtins = {
    'abs': abs,
    'all': all,
    'any': any,
    'bool': bool,
    'dict': dict,
    'enumerate': enumerate,
    'filter': filter,
    'float': float,
    'int': int,
    'len': len,
    'list': list,
    'map': map,
    'max': max,
    'min': min,
    'pow': pow,
    'range': range,
    'round': round,
    'set': set,
    'sorted': sorted,
    'str': str,
    'sum': sum,
    'tuple': tuple,
    'zip': zip,
    'True': True,
    'False': False,
    'None': None,
}

# Read payload from stdin
try:
    payload = json.loads(sys.stdin.read())
    input_data = payload.get('input', {})
    context_data = json.loads(payload.get('__sys_context__', '{}'))
    user_code = payload.get('__sys_code__', '')
except Exception as e:
    print(json.dumps({"ok": False, "error": "SystemError: Failed to read input payload"}))
    sys.exit(1)

# Track output
result = None
emit_called = False
console_logs = []

def emit(value):
    global result, emit_called
    if emit_called:
        raise Exception("emit() can only be called once")
    emit_called = True
    result = value

# Helper functions (Python implementations)
class Helpers:
    class date:
        @staticmethod
        def now():
            return datetime.now().isoformat()

        @staticmethod
        def add(date_str, value, unit):
            try:
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                if unit == 'days':
                    return (dt + timedelta(days=value)).isoformat()
                elif unit == 'hours':
                    return (dt + timedelta(hours=value)).isoformat()
                elif unit == 'minutes':
                    return (dt + timedelta(minutes=value)).isoformat()
                elif unit == 'seconds':
                    return (dt + timedelta(seconds=value)).isoformat()
                else:
                    raise ValueError(f"Unknown unit: {unit}")
            except Exception as e:
                raise ValueError(f"Date error: {str(e)}")

    class string:
        @staticmethod
        def upper(s):
            return str(s).upper()

        @staticmethod
        def lower(s):
            return str(s).lower()

        @staticmethod
        def trim(s):
            return str(s).strip()

        @staticmethod
        def slug(s):
            import re
            s = str(s).lower()
            s = re.sub(r'\\s+', '-', s)
            s = re.sub(r'[^a-z0-9-]', '', s)
            return s

    class number:
        @staticmethod
        def round(num, decimals=0):
            return round(float(num), decimals)

        @staticmethod
        def ceil(num):
            return math.ceil(float(num))

        @staticmethod
        def floor(num):
            return math.floor(float(num))

        @staticmethod
        def abs(num):
            return abs(float(num))

    class array:
        @staticmethod
        def unique(arr):
            # Sort to make deterministic, but handle mixed types gracefully
            return list(set(arr))

        @staticmethod
        def flatten(arr):
            result = []
            for item in arr:
                if isinstance(item, list):
                    result.extend(Helpers.array.flatten(item))
                else:
                    result.append(item)
            return result

    class math:
        @staticmethod
        def sum(arr):
            return sum(arr)

        @staticmethod
        def avg(arr):
            return sum(arr) / len(arr) if len(arr) > 0 else 0

        @staticmethod
        def min(arr):
            return min(arr)

        @staticmethod
        def max(arr):
            return max(arr)

    class console:
        @staticmethod
        def log(*args):
            console_logs.append(list(args))

        @staticmethod
        def warn(*args):
            console_logs.append(['[WARN]'] + list(args))

        @staticmethod
        def error(*args):
            console_logs.append(['[ERROR]'] + list(args))

helpers = Helpers()

# Create execution namespace
namespace = {
    '__builtins__': safe_builtins,
    'input': input_data,
    'context': context_data,
    'helpers': helpers,
    'emit': emit,
}

# Execute user code
try:
    exec(user_code, namespace)
except Exception as e:
    print(json.dumps({
        "ok": False, 
        "error": f"{type(e).__name__}: {str(e)}",
        "consoleLogs": console_logs
    }))
    sys.exit(0)

if not emit_called:
    print(json.dumps({
        "ok": False, 
        "error": "Code did not call emit() to produce output", 
        "consoleLogs": console_logs
    }))
    sys.exit(0)

# Output result as JSON
output = {
    "ok": True,
    "output": result
}

if console_logs:
    output["consoleLogs"] = console_logs

try:
    print(json.dumps(output))
except Exception as e:
     print(json.dumps({
        "ok": False, 
        "error": "OutputError: Failed to serialize output", 
        "consoleLogs": console_logs
    }))
`;

      let stdout = "";
      let stderr = "";
      let killed = false;
      const startTime = Date.now();

      // Spawn Python subprocess
      const pythonProcess = spawn("python3", ["-c", pythonWrapper], {
        timeout: actualTimeout,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Set timeout to kill process
      const timeoutHandle = setTimeout(() => {
        if (!pythonProcess.killed) {
          killed = true;
          pythonProcess.kill("SIGKILL");
        }
      }, actualTimeout);

      // Collect stdout
      pythonProcess.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
        // Enforce max output size
        if (stdout.length > MAX_OUTPUT_SIZE) {
          pythonProcess.kill("SIGKILL");
          killed = true;
        }
      });

      // Collect stderr
      pythonProcess.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
        if (stderr.length > MAX_OUTPUT_SIZE) {
          pythonProcess.kill("SIGKILL");
          killed = true;
        }
      });

      // Handle process completion
      pythonProcess.on("close", (code: number | null) => {
        clearTimeout(timeoutHandle);
        const durationMs = Date.now() - startTime;

        if (killed) {
          resolve({
            ok: false,
            error: "TimeoutError: Execution exceeded time limit",
            durationMs,
          });
          return;
        }

        if (code !== 0) {
          const errorLines = stderr.trim().split("\n");
          const lastLine = errorLines[errorLines.length - 1] || "Unknown error";
          resolve({
            ok: false,
            error: `PythonProcessError: ${lastLine.slice(0, 500)}`,
            durationMs,
          });
          return;
        }

        try {
          // Parse JSON output
          const result = JSON.parse(stdout.trim());
          result.durationMs = durationMs;
          resolve(result);
        } catch (parseError) {
          resolve({
            ok: false,
            error: `OutputError: Failed to parse Python output - ${parseError instanceof Error ? parseError.message : 'unknown error'}`,
            durationMs,
          });
        }
      });

      // Handle process errors
      pythonProcess.on("error", (error: Error) => {
        clearTimeout(timeoutHandle);
        resolve({
          ok: false,
          error: `ProcessError: ${error.message}`,
          durationMs: Date.now() - startTime,
        });
      });

      // Send payload to stdin
      pythonProcess.stdin.write(payloadJson);
      pythonProcess.stdin.end();
    } catch (error) {
      resolve({
        ok: false,
        error: `SetupError: ${error instanceof Error ? error.message : 'unknown error'}`,
      });
    }
  });
}

/**
 * Execute code with helpers and context injection
 * Main entry point for enhanced sandbox execution
 */
export async function executeCodeWithHelpers(
  params: ExecuteCodeWithHelpersParams
): Promise<ScriptExecutionResult> {
  const {
    language,
    code,
    input,
    context,
    helpers,
    timeoutMs = 1000,
    consoleEnabled = false,
  } = params;

  if (language === "javascript") {
    return runJsWithHelpers(
      code,
      input,
      context,
      helpers || createHelperLibrary({ consoleEnabled }).helpers,
      timeoutMs,
      consoleEnabled
    );
  } else if (language === "python") {
    return runPythonWithHelpers(code, input, context, timeoutMs, consoleEnabled);
  } else {
    return {
      ok: false,
      error: `Unsupported language: ${language}`,
    };
  }
}
