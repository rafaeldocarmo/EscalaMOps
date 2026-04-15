export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEvent = {
  level: LogLevel;
  event: string;
  message?: string;
  data?: Record<string, unknown>;
};

function shouldLogDebug(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.LOG_LEVEL === "debug";
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "log_json_stringify_failed" });
  }
}

/**
 * Minimal structured logger (stdout/stderr) with stable shape.
 * Intentionally dependency-free to keep prod risk low.
 */
export function log(evt: LogEvent): void {
  if (evt.level === "debug" && !shouldLogDebug()) return;

  const payload = {
    ts: new Date().toISOString(),
    level: evt.level,
    event: evt.event,
    message: evt.message,
    ...evt.data,
  };

  const line = safeJson(payload);
  if (evt.level === "error") console.error(line);
  else if (evt.level === "warn") console.warn(line);
  else console.log(line);
}

