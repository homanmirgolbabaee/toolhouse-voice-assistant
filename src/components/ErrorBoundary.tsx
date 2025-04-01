"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import logger from "@/utils/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error
    const componentName = this.props.componentName || "Unknown Component";
    logger.error("ui", `Error in ${componentName}:`, {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      stack: error.stack
    });
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Set the errorInfo in state
    this.setState({ errorInfo });
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 max-w-lg mx-auto my-8">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
            <h2 className="text-lg font-semibold">Something went wrong</h2>
          </div>
          
          <div className="mb-4 text-sm">
            <p className="mb-2">An error occurred in this component:</p>
            {this.state.error && (
              <pre className="bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-auto text-xs max-h-32 mb-2">
                {this.state.error.toString()}
              </pre>
            )}
          </div>
          
          <button
            onClick={this.resetError}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
          
          {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer select-none text-red-700 dark:text-red-300 mb-1">Component Stack</summary>
              <pre className="bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-auto max-h-64">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;