"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Terminal,
  X,
  Copy,
  Check,
  Download,
  Trash2,
  Bug,
  Filter,
  Search,
  ExternalLink,
} from "lucide-react";
import { logger, LogEntry, LogLevel } from "@/lib/logger";

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DiagnosticsModal({ isOpen, onClose }: DiagnosticsModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<LogLevel | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Sync logs when open and listen to live updates
  useEffect(() => {
    if (!isOpen) return;

    setLogs(logger.getLogs());

    const unsubscribe = logger.subscribe((newEntry) => {
      setLogs((prev) => [...prev.slice(-249), newEntry]);
    });

    return unsubscribe;
  }, [isOpen]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel = filterLevel === "ALL" || log.level === filterLevel;
      const matchesQuery =
        !searchQuery ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesLevel && matchesQuery;
    });
  }, [logs, filterLevel, searchQuery]);

  const errorCount = useMemo(() => logs.filter((l) => l.level === "ERROR").length, [logs]);
  const actionCount = useMemo(() => logs.filter((l) => l.level === "ACTION").length, [logs]);
  const apiCount = useMemo(() => logs.filter((l) => l.level === "API").length, [logs]);

  const handleCopyDiagnostics = async () => {
    const report = {
      generatedAt: new Date().toISOString(),
      sessionId: logger.getSessionId(),
      userContext: logger.getUserContext(),
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "",
      logsCount: logs.length,
      logs: logs.slice(-50),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleTestError = () => {
    logger.error(
      "Test Diagnostic Error simulated by user",
      new Error("Manual diagnostic test exception triggered via UI"),
      { testSource: "DiagnosticsModal" },
      "Diagnostics"
    );
  };

  const handleClear = () => {
    logger.clearLogs();
    setLogs([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-sm">System Diagnostics &amp; UI Telemetry</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {logs.length} events
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Session: {logger.getSessionId()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyDiagnostics}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Copy diagnostic report to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Report</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => logger.downloadLogs()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Download JSON log file"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Filters & Search */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setFilterLevel("ALL")}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                filterLevel === "ALL"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-750"
              }`}
            >
              All ({logs.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterLevel("ACTION")}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                filterLevel === "ACTION"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800 text-purple-400 hover:bg-slate-750"
              }`}
            >
              Actions ({actionCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterLevel("API")}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                filterLevel === "API"
                  ? "bg-teal-600 text-white"
                  : "bg-slate-800 text-teal-400 hover:bg-slate-750"
              }`}
            >
              API ({apiCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterLevel("ERROR")}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                filterLevel === "ERROR"
                  ? "bg-red-600 text-white"
                  : "bg-slate-800 text-red-400 hover:bg-slate-750"
              }`}
            >
              Errors ({errorCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterLevel("WARN")}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
                filterLevel === "WARN"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-800 text-amber-400 hover:bg-slate-750"
              }`}
            >
              Warnings
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-750 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
              />
            </div>

            <button
              type="button"
              onClick={handleTestError}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition-colors"
              title="Trigger a test error to verify telemetry and error boundary"
            >
              <Bug className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simulate Error</span>
            </button>
          </div>
        </div>

        {/* Log Stream Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs select-text">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-12">
              <Filter className="w-8 h-8 opacity-40" />
              <p>No log records match the current filter criteria.</p>
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const isExpanded = expandedLogId === entry.id;
              const time = entry.timestamp.split("T")[1]?.replace("Z", "") || entry.timestamp;

              let badgeBg = "bg-slate-800 text-slate-300 border-slate-700";
              if (entry.level === "ERROR") badgeBg = "bg-red-950/80 text-red-400 border-red-800/50";
              else if (entry.level === "WARN") badgeBg = "bg-amber-950/80 text-amber-400 border-amber-800/50";
              else if (entry.level === "ACTION") badgeBg = "bg-purple-950/80 text-purple-400 border-purple-800/50";
              else if (entry.level === "API") badgeBg = "bg-teal-950/80 text-teal-400 border-teal-800/50";
              else if (entry.level === "INFO") badgeBg = "bg-sky-950/80 text-sky-400 border-sky-800/50";

              return (
                <div
                  key={entry.id}
                  className={`p-2.5 rounded-lg border transition-all ${
                    entry.level === "ERROR"
                      ? "bg-red-950/20 border-red-900/40"
                      : "bg-slate-950/40 border-slate-800/60 hover:border-slate-700"
                  }`}
                >
                  <div
                    className="flex items-start justify-between gap-2 cursor-pointer"
                    onClick={() => setExpandedLogId(isExpanded ? null : entry.id)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-500 text-[11px]">{time}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${badgeBg}`}
                      >
                        {entry.level}
                      </span>
                      <span className="text-indigo-400 font-semibold text-[11px]">
                        [{entry.module}]
                      </span>
                      <span className="text-slate-200 text-xs font-sans">{entry.message}</span>
                      {entry.durationMs !== undefined && (
                        <span className="text-[10px] text-teal-400 font-mono">
                          +{entry.durationMs.toFixed(0)}ms
                        </span>
                      )}
                    </div>

                    {(entry.data || entry.error) && (
                      <span className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors shrink-0">
                        {isExpanded ? "Hide details ▲" : "View details ▼"}
                      </span>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-2 text-[11px]">
                      {entry.error && (
                        <div className="p-2.5 bg-red-950/30 rounded border border-red-900/40 text-red-300 space-y-1">
                          <p className="font-bold">{entry.error.name}: {entry.error.message}</p>
                          {entry.error.stack && (
                            <pre className="text-[10px] text-red-400/80 whitespace-pre-wrap overflow-x-auto max-h-36">
                              {entry.error.stack}
                            </pre>
                          )}
                        </div>
                      )}

                      {entry.data && (
                        <div className="p-2.5 bg-slate-900 rounded border border-slate-800 overflow-x-auto">
                          <pre className="text-slate-300 text-[10px]">
                            {JSON.stringify(entry.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Tip: Press Ctrl+Shift+D anywhere to toggle this panel.</span>
          <span>DocSpace Telemetry v1.0</span>
        </div>
      </div>
    </div>
  );
}
