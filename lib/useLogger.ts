"use client";

import { useMemo } from "react";
import { logger } from "./logger";

/**
 * React hook to obtain a scoped logger instance for any component.
 *
 * @example
 * ```tsx
 * const log = useLogger("CalendarTab");
 * log.action("clicked_sync_google");
 * log.error("Failed to load appointments", err);
 * ```
 */
export function useLogger(moduleName: string) {
  return useMemo(() => {
    return logger.createScopedLogger(moduleName);
  }, [moduleName]);
}

export default useLogger;
