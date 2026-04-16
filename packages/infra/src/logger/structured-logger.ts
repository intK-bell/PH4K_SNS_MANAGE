export interface LogContext {
  correlationId: string;
  component: string;
  operation: string;
  [key: string]: unknown;
}

const toErrorPayload = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
};

const write = (
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  context: LogContext,
  extra?: Record<string, unknown>,
) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    ...(extra ?? {}),
  };

  const line = JSON.stringify(payload);
  if (level === "ERROR") {
    console.error(line);
    return;
  }
  if (level === "WARN") {
    console.warn(line);
    return;
  }
  console.log(line);
};

export const createLogger = (context: LogContext) => ({
  info: (message: string, extra?: Record<string, unknown>) =>
    write("INFO", message, context, extra),
  warn: (message: string, extra?: Record<string, unknown>) =>
    write("WARN", message, context, extra),
  error: (message: string, error?: unknown, extra?: Record<string, unknown>) =>
    write("ERROR", message, context, {
      ...(extra ?? {}),
      ...(error === undefined ? {} : { error: toErrorPayload(error) }),
    }),
});
