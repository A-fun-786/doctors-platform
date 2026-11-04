"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, Copy, Check } from "lucide-react";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    const componentScope = this.props.moduleName || "ErrorBoundary";
    logger.error(
      componentScope,
      `Unhandled React component error: ${error.message}`,
      error,
      {
        componentStack: errorInfo.componentStack,
        propsFallback: this.props.fallbackTitle,
      }
    );
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
  };

  handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleCopyDiagnostics = async (): Promise<void> => {
    const diagnosticPayload = {
      error: {
        message: this.state.error?.message,
        name: this.state.error?.name,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
      },
      userContext: logger.getUserContext(),
      sessionId: logger.getSessionId(),
      url: typeof window !== "undefined" ? window.location.href : "",
      timestamp: new Date().toISOString(),
      recentLogs: logger.getLogs().slice(-20),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnosticPayload, null, 2));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      // Fallback
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || "Something went wrong in this section";
      const message =
        this.props.fallbackMessage ||
        "An unexpected error occurred while rendering this component. The issue has been logged for engineering review.";

      return (
        <div className="p-6 my-4 bg-white border border-red-200 rounded-2xl shadow-sm text-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{message}</p>

              {this.state.error && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-red-700 overflow-x-auto max-h-32">
                  {this.state.error.message}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleReload}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Page</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleCopyDiagnostics}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                  title="Copy error details to clipboard for support"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Diagnostics Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Diagnostics</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
