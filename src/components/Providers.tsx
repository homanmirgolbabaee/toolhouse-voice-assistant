"use client";

import React, { PropsWithChildren, useState, useEffect } from "react";
import { LoggerProvider } from "@/contexts/LoggerContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import DebugPanel from "@/components/DebugPanel";
import errorTracker from "@/utils/errorTracker";
import logger from "@/utils/logger";

interface ProvidersProps extends PropsWithChildren {
  appName?: string;
  version?: string;
  environment?: string;
}

export default function Providers({
  children,
  appName = "Toolhouse Assistant",
  version = "1.0.0",
  environment = process.env.NODE_ENV,
}: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  // Initialize error tracking and other utilities
  useEffect(() => {
    logger.info('session', 'Initializing application', {
      appName,
      version,
      environment
    });
    
    // Initialize error tracking
    errorTracker.init();
    
    // Log app version and environment
    logger.info('session', `App: ${appName} v${version} (${environment})`);
    
    // Mark as mounted
    setMounted(true);
    
    // Add some browser information for debugging
    if (typeof window !== 'undefined') {
      logger.debug('session', 'Browser info', {
        userAgent: navigator.userAgent,
        language: navigator.language,
        online: navigator.onLine,
        memory: navigator.deviceMemory,
        screenSize: {
          width: window.screen.width,
          height: window.screen.height
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      });
    }
    
    return () => {
      logger.info('session', 'Application cleanup');
    };
  }, [appName, version, environment]);

  // Handle global errors
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    errorTracker.trackError(error, 'ApplicationRoot', {
      reactErrorInfo: errorInfo,
      type: 'boundary'
    });
  };

  return (
    <ErrorBoundary 
      componentName="ApplicationRoot"
      onError={handleError}
    >
      <LoggerProvider
        applicationName={appName}
        version={version}
        environment={environment}
      >
        {children}
        {mounted && <DebugPanel showOnlyInDevelopment={true} />}
      </LoggerProvider>
    </ErrorBoundary>
  );
}