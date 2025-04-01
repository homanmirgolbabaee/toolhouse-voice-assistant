"use client";

import React, { createContext, useContext, useEffect, PropsWithChildren, useState } from "react";
import logger from "@/utils/logger";

// Define the context type
interface LoggerContextType {
  logEvent: (category: string, action: string, data?: any) => void;
  logError: (error: Error, componentName: string, additionalInfo?: any) => void;
  logWarning: (message: string, componentName: string, additionalInfo?: any) => void;
  logNavigation: (from: string, to: string) => void;
  logInteraction: (element: string, action: string, additionalInfo?: any) => void;
  setUserId: (userId: string) => void;
  logSessionInfo: (info: Record<string, any>) => void;
}

// Create the context with default values
const LoggerContext = createContext<LoggerContextType>({
  logEvent: () => {},
  logError: () => {},
  logWarning: () => {},
  logNavigation: () => {},
  logInteraction: () => {},
  setUserId: () => {},
  logSessionInfo: () => {},
});

// Export the hook for using the logger context
export const useLogger = () => useContext(LoggerContext);

// Properties for the provider component
interface LoggerProviderProps extends PropsWithChildren {
  applicationName?: string;
  version?: string;
  environment?: string;
}

// Provider component
export const LoggerProvider: React.FC<LoggerProviderProps> = ({
  children,
  applicationName = "Toolhouse Assistant",
  version = "1.0.0",
  environment = process.env.NODE_ENV,
}) => {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [sessionId] = useState<string>(`session_${Math.random().toString(36).substring(2, 9)}`);

  // Initialize global error handler
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      logger.error("global", "Unhandled error:", {
        message: event.message,
        source: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        error: event.error?.stack || "No stack trace available",
      });
      
      // Optionally, you could send this to a monitoring service
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error("global", "Unhandled promise rejection:", {
        reason: event.reason?.toString() || "Unknown reason",
        stack: event.reason?.stack || "No stack trace available",
      });
      
      // Optionally, you could send this to a monitoring service
    };

    // Log session start
    logger.info("session", "Session started", {
      applicationName,
      version,
      environment,
      sessionId,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Add global error handlers
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Clean up the event listeners
    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      
      // Log session end
      logger.info("session", "Session ended", {
        sessionId,
        duration: `${Math.round((performance.now()) / 1000)}s`,
        timestamp: new Date().toISOString(),
      });
    };
  }, [applicationName, environment, sessionId, version]);

  // Log context functions
  const logEvent = (category: string, action: string, data?: any) => {
    logger.info("event", `${category}:${action}`, {
      ...data,
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    });
  };

  const logError = (error: Error, componentName: string, additionalInfo?: any) => {
    logger.error("error", `Error in ${componentName}: ${error.message}`, {
      ...additionalInfo,
      stack: error.stack,
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    });
  };

  const logWarning = (message: string, componentName: string, additionalInfo?: any) => {
    logger.warn("warning", `Warning in ${componentName}: ${message}`, {
      ...additionalInfo,
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    });
  };

  const logNavigation = (from: string, to: string) => {
    logger.info("navigation", `Navigation from ${from} to ${to}`, {
      from,
      to,
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    });
  };

  const logInteraction = (element: string, action: string, additionalInfo?: any) => {
    logger.info("interaction", `Interaction: ${action} on ${element}`, {
      ...additionalInfo,
      element,
      action,
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    });
  };

  const logSessionInfo = (info: Record<string, any>) => {
    logger.info("session", "Session info updated", {
      ...info,
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
    });
  };

  // Update user ID function
  const updateUserId = (newUserId: string) => {
    setUserId(newUserId);
    logger.info("session", "User ID set", {
      userId: newUserId,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  };

  // Context value
  const contextValue: LoggerContextType = {
    logEvent,
    logError,
    logWarning,
    logNavigation,
    logInteraction,
    setUserId: updateUserId,
    logSessionInfo,
  };

  return (
    <LoggerContext.Provider value={contextValue}>
      {children}
    </LoggerContext.Provider>
  );
};

export default LoggerContext;