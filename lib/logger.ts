type SentryModule = typeof import("@sentry/nextjs");
let sentryClient: SentryModule | null = null;

if (typeof window !== "undefined") {
  import("@sentry/nextjs")
    .then((mod) => {
      sentryClient = mod;
    })
    .catch(() => {});
}

export type LogLevel = "DEBUG" | "INFO" | "ACTION" | "API" | "WARN" | "ERROR";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  sessionId: string;
  durationMs?: number;
}

export interface UserContext {
  userId?: string;
  email?: string;
  tenantSlug?: string;
  role?: string;
}

type LogListener = (entry: LogEntry) => void;

const SENSITIVE_KEYS = new Set([
  "password",
  "credential",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "secret",
  "apikey",
  "private_key",
  "cookie",
  "credit_card",
  "cvv",
]);

/**
 * Deep sanitization of payloads to prevent leaking passwords, tokens or credentials.
 */
function sanitizeData(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[MaxDepthReached]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    // Basic mask for JWT-like strings
    if (value.startsWith("eyJ") && value.split(".").length === 3) {
      return `${value.slice(0, 10)}...[MASKED_JWT]`;
    }
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeData(item, depth + 1));
  }

  if (typeof value === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitizedObj[key] = "[REDACTED]";
      } else {
        sanitizedObj[key] = sanitizeData(val, depth + 1);
      }
    }
    return sanitizedObj;
  }

  return String(value);
}

/**
 * Session ID generator & storage in sessionStorage.
 */
function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return "server-session";
  }
  try {
    let sid = window.sessionStorage.getItem("docspace_session_id");
    if (!sid) {
      sid = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      window.sessionStorage.setItem("docspace_session_id", sid);
    }
    return sid;
  } catch {
    return "fallback-session";
  }
}

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  ACTION: 25,
  API: 25,
  WARN: 30,
  ERROR: 40,
};

const CONSOLE_COLORS: Record<LogLevel, { bg: string; text: string }> = {
  DEBUG: { bg: "#475569", text: "#f8fafc" },
  INFO: { bg: "#0284c7", text: "#f8fafc" },
  ACTION: { bg: "#7c3aed", text: "#ffffff" },
  API: { bg: "#0d9488", text: "#ffffff" },
  WARN: { bg: "#d97706", text: "#ffffff" },
  ERROR: { bg: "#dc2626", text: "#ffffff" },
};

class ProductionLogger {
  private buffer: LogEntry[] = [];
  private maxBufferSize = 250;
  private listeners: Set<LogListener> = new Set();
  private userContext: UserContext = {};
  private minLevel: LogLevel = "DEBUG";
  private sessionId: string;

  constructor() {
    this.sessionId = getOrCreateSessionId();

    if (typeof window !== "undefined") {
      // Expose diagnostic tools on window for developers and customer support
      (window as unknown as { __DOCSPACE_LOGS__: unknown }).__DOCSPACE_LOGS__ = {
        getLogs: () => this.getLogs(),
        dumpLogs: () => this.dumpLogs(),
        downloadLogs: () => this.downloadLogs(),
        clearLogs: () => this.clearLogs(),
        setLogLevel: (level: LogLevel) => this.setLogLevel(level),
        getSessionId: () => this.sessionId,
        getUserContext: () => this.userContext,
      };
    }
  }

  public setLogLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public setUserContext(context: UserContext): void {
    this.userContext = { ...this.userContext, ...context };

    try {
      if (sentryClient && (context.userId || context.email)) {
        sentryClient.setUser({
          id: context.userId,
          email: context.email,
          username: context.tenantSlug,
        });
      }
    } catch {
      // Sentry might not be initialized
    }
  }

  public getUserContext(): UserContext {
    return { ...this.userContext };
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLogs(): LogEntry[] {
    return [...this.buffer];
  }

  public clearLogs(): void {
    this.buffer = [];
  }

  private write(
    level: LogLevel,
    module: string,
    message: string,
    data?: Record<string, unknown>,
    rawError?: unknown,
    durationMs?: number
  ): LogEntry {
    const sanitizedData = data ? (sanitizeData(data) as Record<string, unknown>) : undefined;

    let parsedError: LogEntry["error"];
    if (rawError) {
      if (rawError instanceof Error) {
        parsedError = {
          name: rawError.name,
          message: rawError.message,
          stack: rawError.stack,
        };
      } else if (typeof rawError === "object") {
        parsedError = {
          name: "ObjectError",
          message: JSON.stringify(sanitizeData(rawError)),
        };
      } else {
        parsedError = {
          name: "UnknownError",
          message: String(rawError),
        };
      }
    }

    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data: sanitizedData,
      error: parsedError,
      sessionId: this.sessionId,
      durationMs,
    };

    // Maintain circular buffer
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Notify active UI listeners (e.g. diagnostics modal)
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {
        // Prevent listener failures from breaking application flow
      }
    });

    // Console output
    if (LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[this.minLevel]) {
      this.printConsole(entry);
    }

    // Sentry reporting
    this.sendToSentry(entry, rawError);

    return entry;
  }

  private printConsole(entry: LogEntry): void {
    const isBrowser = typeof window !== "undefined";
    const timeFormatted = entry.timestamp.split("T")[1].replace("Z", "");
    const colors = CONSOLE_COLORS[entry.level];

    if (isBrowser) {
      const badgeStyle = `background: ${colors.bg}; color: ${colors.text}; font-weight: bold; border-radius: 4px; padding: 2px 6px; font-size: 10px;`;
      const moduleStyle = "color: #64748b; font-weight: 600; font-size: 11px;";
      const timeStyle = "color: #94a3b8; font-size: 10px;";
      const msgStyle = "color: #0f172a; font-weight: 500; font-size: 12px;";

      const durationText = entry.durationMs !== undefined ? ` (+${entry.durationMs.toFixed(0)}ms)` : "";

      if (entry.level === "ERROR") {
        console.error(
          `%c${entry.level}%c [${entry.module}]%c ${timeFormatted}%c ${entry.message}${durationText}`,
          badgeStyle,
          moduleStyle,
          timeStyle,
          msgStyle,
          entry.data || "",
          entry.error?.stack || entry.error || ""
        );
      } else if (entry.level === "WARN") {
        console.warn(
          `%c${entry.level}%c [${entry.module}]%c ${timeFormatted}%c ${entry.message}${durationText}`,
          badgeStyle,
          moduleStyle,
          timeStyle,
          msgStyle,
          entry.data || ""
        );
      } else {
        console.log(
          `%c${entry.level}%c [${entry.module}]%c ${timeFormatted}%c ${entry.message}${durationText}`,
          badgeStyle,
          moduleStyle,
          timeStyle,
          msgStyle,
          entry.data || ""
        );
      }
    } else {
      // Node.js server logging format
      const durationText = entry.durationMs !== undefined ? ` [${entry.durationMs.toFixed(0)}ms]` : "";
      const text = `[${entry.timestamp}] [${entry.level}] [${entry.module}] ${entry.message}${durationText}`;
      if (entry.level === "ERROR") {
        console.error(text, entry.data || "", entry.error || "");
      } else if (entry.level === "WARN") {
        console.warn(text, entry.data || "");
      } else {
        console.log(text, entry.data || "");
      }
    }
  }

  private sendToSentry(entry: LogEntry, rawError?: unknown): void {
    if (!sentryClient) return;

    try {
      if (entry.level === "ERROR") {
        const errorToCapture =
          rawError instanceof Error ? rawError : new Error(`${entry.module}: ${entry.message}`);

        sentryClient.captureException(errorToCapture, {
          tags: {
            module: entry.module,
            sessionId: entry.sessionId,
            tenantSlug: this.userContext.tenantSlug || "anonymous",
          },
          extra: {
            logId: entry.id,
            timestamp: entry.timestamp,
            data: entry.data,
            durationMs: entry.durationMs,
          },
        });
      } else {
        // Send breadcrumbs to Sentry for actions, api, and info
        const sentryLevelMap: Record<LogLevel, "debug" | "info" | "warning" | "error"> = {
          DEBUG: "debug",
          INFO: "info",
          ACTION: "info",
          API: "info",
          WARN: "warning",
          ERROR: "error",
        };

        sentryClient.addBreadcrumb({
          category: entry.module,
          message: entry.message,
          level: sentryLevelMap[entry.level],
          data: {
            ...entry.data,
            durationMs: entry.durationMs,
          },
          timestamp: Date.now() / 1000,
        });
      }
    } catch {
      // Sentry SDK not initialized or errored — fail silently so logging never breaks app
    }
  }

  public debug(module: string, message: string, data?: Record<string, unknown>): LogEntry {
    return this.write("DEBUG", module, message, data);
  }

  public info(module: string, message: string, data?: Record<string, unknown>): LogEntry {
    return this.write("INFO", module, message, data);
  }

  /**
   * Track high-level user actions (clicks, submits, navigations, toggles).
   */
  public action(
    module: string,
    actionName: string,
    details?: Record<string, unknown>
  ): LogEntry {
    return this.write("ACTION", module, actionName, details);
  }

  /**
   * Track API request lifecycle, status codes, and latency.
   */
  public api(
    module: string,
    message: string,
    meta?: {
      method?: string;
      url?: string;
      status?: number;
      durationMs?: number;
      requestId?: string;
      [key: string]: unknown;
    },
    error?: unknown
  ): LogEntry {
    const level: LogLevel = error || (meta?.status && meta.status >= 400) ? "ERROR" : "API";
    return this.write(level, module, message, meta, error, meta?.durationMs);
  }

  public warn(module: string, message: string, data?: Record<string, unknown>): LogEntry {
    return this.write("WARN", module, message, data);
  }

  public error(
    moduleOrMessage: string,
    messageOrError?: unknown,
    errorOrData?: unknown,
    dataOrModule?: unknown
  ): LogEntry {
    let scope = "App";
    let message = "";
    let err: unknown = undefined;
    let data: Record<string, unknown> | undefined = undefined;

    if (typeof messageOrError === "string") {
      scope = moduleOrMessage;
      message = messageOrError;
      err = errorOrData;
      data =
        typeof dataOrModule === "object" && dataOrModule !== null
          ? (dataOrModule as Record<string, unknown>)
          : undefined;
    } else {
      message = moduleOrMessage;
      err = messageOrError;
      data =
        typeof errorOrData === "object" && !(errorOrData instanceof Error)
          ? (errorOrData as Record<string, unknown>)
          : undefined;
      if (typeof dataOrModule === "string") {
        scope = dataOrModule;
      }
    }

    return this.write("ERROR", scope, message, data, err);
  }

  /**
   * Generates a complete JSON diagnostic report file for customer support.
   */
  public downloadLogs(): void {
    if (typeof window === "undefined") return;

    const report = {
      generatedAt: new Date().toISOString(),
      sessionId: this.sessionId,
      userContext: this.userContext,
      userAgent: window.navigator.userAgent,
      url: window.location.href,
      logsCount: this.buffer.length,
      logs: this.buffer,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `docspace-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Pretty-prints recent logs in table format in the console.
   */
  public dumpLogs(): void {
    if (typeof console.table === "function") {
      console.table(
        this.buffer.map((entry) => ({
          Time: entry.timestamp.split("T")[1].replace("Z", ""),
          Level: entry.level,
          Module: entry.module,
          Message: entry.message,
          Duration: entry.durationMs ? `${entry.durationMs.toFixed(0)}ms` : "-",
        }))
      );
    } else {
      console.log(this.buffer);
    }
  }

  /**
   * Factory method to create a module-scoped logger.
   */
  public createScopedLogger(moduleName: string) {
    return {
      debug: (message: string, data?: Record<string, unknown>) =>
        this.debug(moduleName, message, data),
      info: (message: string, data?: Record<string, unknown>) =>
        this.info(moduleName, message, data),
      action: (actionName: string, details?: Record<string, unknown>) =>
        this.action(moduleName, actionName, details),
      api: (
        message: string,
        meta?: {
          method?: string;
          url?: string;
          status?: number;
          durationMs?: number;
          requestId?: string;
          [key: string]: unknown;
        },
        error?: unknown
      ) => this.api(moduleName, message, meta, error),
      warn: (message: string, data?: Record<string, unknown>) =>
        this.warn(moduleName, message, data),
      error: (message: string, error?: unknown, data?: Record<string, unknown>) =>
        this.error(moduleName, message, error, data),
    };
  }
}

// Global singleton instance
export const logger = new ProductionLogger();

export default logger;
