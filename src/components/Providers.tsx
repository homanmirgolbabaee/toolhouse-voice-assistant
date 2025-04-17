// src/components/Providers.tsx
"use client";

import React, { PropsWithChildren, useState, useEffect } from "react";
import { LoggerProvider } from "@/contexts/LoggerContext";
import { TTSProvider } from "@/contexts/TTSContext";
import TextSelectionTTS from "@/components/TextSelectionTTS";
import ApiKeySetup from "@/components/ApiKeySetup";

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
  const [ttsEnabled, setTTSEnabled] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [initialApiKeyCheck, setInitialApiKeyCheck] = useState(false);

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
      
      // Check if TTS is enabled
      const ttsEnabledStr = localStorage.getItem('elevenlabs_tts_enabled');
      setTTSEnabled(ttsEnabledStr !== 'false'); // Default to true if not set
      
      // Check if API key exists - if not, we won't show the modal automatically but it will just work
      const apiKey = localStorage.getItem('elevenlabs_api_key');
      setInitialApiKeyCheck(true);
      
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
        <TTSProvider>
          {children}

          {/* Text Selection TTS popup component */}
          {mounted && ttsEnabled && <TextSelectionTTS />}
          
          {/* API Key Setup Modal if shown */}
          {mounted && showApiKeyModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <ApiKeySetup onClose={() => setShowApiKeyModal(false)} />
            </div>
          )}
          
          {/* Debug Panel in development */}
          {process.env.NODE_ENV === 'development' && <DebugPanel showOnlyInDevelopment={true} />}
        </TTSProvider>
      </LoggerProvider>
    </ErrorBoundary>
  );
}