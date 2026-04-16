const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const buildNextRetryAt = (baseTime: Date, delayMs: number): string =>
  new Date(baseTime.getTime() + delayMs).toISOString();

export const retry = async <T>(
  fn: () => Promise<T>,
  options?: {
    attempts?: number;
    initialDelayMs?: number;
    onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void | Promise<void>;
  },
): Promise<T> => {
  const attempts = options?.attempts ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 1000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      const nextDelayMs = initialDelayMs * attempt;
      await options?.onRetry?.(attempt, error, nextDelayMs);
      await sleep(nextDelayMs);
    }
  }

  throw lastError;
};
