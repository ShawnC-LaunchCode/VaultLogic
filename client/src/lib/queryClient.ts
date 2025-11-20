import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Check if an error is retryable (network error or 5xx server error)
 */
function isRetryableError(error: unknown, status?: number): boolean {
  // Network errors (fetch failed, timeout, etc.)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // 5xx server errors are retryable
  if (status && status >= 500) {
    return true;
  }

  // 4xx client errors are NOT retryable
  return false;
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(retryCount: number): number {
  // Exponential backoff: 1s, 2s, 4s
  return Math.min(1000 * Math.pow(2, retryCount), 4000);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: data ? { "Content-Type": "application/json" } : {},
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });

      // If response is not ok, check if it's retryable
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        const error = new Error(`${res.status}: ${text}`);

        // Don't retry on 4xx client errors
        if (!isRetryableError(error, res.status)) {
          throw error;
        }

        // If we have retries left, continue to retry logic
        if (attempt < maxRetries) {
          lastError = error;
          const delay = getRetryDelay(attempt);
          console.log(`Request failed with ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await sleep(delay);
          continue;
        }

        throw error;
      }

      return res;
    } catch (error) {
      // Network errors or other fetch failures
      if (error instanceof Error) {
        // Check if this is retryable
        if (!isRetryableError(error)) {
          throw error;
        }

        // If we have retries left, retry
        if (attempt < maxRetries) {
          lastError = error;
          const delay = getRetryDelay(attempt);
          console.log(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, error.message);
          await sleep(delay);
          continue;
        }
      }

      // No more retries, throw the last error
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Request failed after retries');
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
