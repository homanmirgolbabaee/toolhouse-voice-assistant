// src/components/Providers.tsx
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
  appName = "NotesAI",
  version = "1.0.0",
  environment = process.env.NODE_ENV,
}: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  // Initialize error tracking and other utilities
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    try {
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
    } catch (error) {
      console.error('Error initializing providers:', error);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        logger.info('session', 'Application cleanup');
      }
    };
  }, [appName, version, environment]);

  // Handle global errors
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    try {
      errorTracker.trackError(error, 'ApplicationRoot', {
        reactErrorInfo: errorInfo,
        type: 'boundary'
      });
    } catch (err) {
      console.error('Error in error tracking:', err);
    }
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
        {process.env.NODE_ENV === 'development' && <DebugPanel showOnlyInDevelopment={true} />}
      </LoggerProvider>
    </ErrorBoundary>
  );
}