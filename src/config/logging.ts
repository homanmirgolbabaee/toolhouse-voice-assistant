/**
 * Centralized configuration for application logging and debugging
 * 
 * This file contains all the logging-related settings in one place
 * to make it easier to adjust logging levels and behavior.
 */

// Available log levels
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4, // Use NONE to completely disable a certain type of logging
  }
  
  // Environment-specific settings
  const ENV = process.env.NODE_ENV || 'development';
  const IS_DEVELOPMENT = ENV === 'development';
  const IS_PRODUCTION = ENV === 'production';
  const IS_TEST = ENV === 'test';
  
  // Core logging settings
  export const loggingConfig = {
    // Main logging levels by environment
    defaultLogLevel: IS_PRODUCTION ? LogLevel.INFO : LogLevel.DEBUG,
    
    // Category-specific log levels (override the default)
    categoryLogLevels: {
      api: IS_PRODUCTION ? LogLevel.INFO : LogLevel.DEBUG,
      voice: IS_PRODUCTION ? LogLevel.INFO : LogLevel.DEBUG,
      chat: IS_PRODUCTION ? LogLevel.INFO : LogLevel.DEBUG,
      ui: IS_PRODUCTION ? LogLevel.WARN : LogLevel.DEBUG,
      audio: IS_PRODUCTION ? LogLevel.WARN : LogLevel.DEBUG,
      network: IS_PRODUCTION ? LogLevel.INFO : LogLevel.DEBUG,
      state: IS_PRODUCTION ? LogLevel.WARN : LogLevel.DEBUG,
      performance: IS_PRODUCTION ? LogLevel.INFO : LogLevel.DEBUG,
      session: LogLevel.INFO, // Always log session info
      global: LogLevel.INFO, // Always log global errors
    },
    
    // Log to console settings
    console: {
      enabled: true,
      // Formatted or not
      useColors: !IS_PRODUCTION,
      // Include timestamps in logs
      includeTimestamps: true,
      // Maximum depth for object serialization
      maxObjectDepth: IS_PRODUCTION ? 2 : 5,
      // Truncate long strings in console outputs
      truncateStringsLongerThan: IS_PRODUCTION ? 500 : 2000,
    },
    
    // Debug panel settings
    debugPanel: {
      enabled: !IS_PRODUCTION, // Only in development by default
      showOnLoad: false, // Start minimized
      maxLogEntries: 1000, // Limit the number of log entries to prevent memory issues
      enableKeyboardShortcut: true, // Enable Ctrl+Shift+D shortcut to toggle panel
      showNetworkTab: true,
      showPerformanceTab: true,
      showStateTab: true,
    },
    
    // Performance monitoring settings
    performance: {
      enabled: true,
      // Which operations to track automatically
      autoTrack: {
        apiCalls: true,
        renders: IS_DEVELOPMENT, // Only track component renders in development
        stateChanges: IS_DEVELOPMENT,
        resourceLoading: true,
      },
      // Thresholds for performance warnings (in ms)
      thresholds: {
        apiCallWarning: 1000, // Warn if API calls take longer than 1s
        renderWarning: 50, // Warn if renders take longer than 50ms
        resourceWarning: 3000, // Warn if resources take longer than 3s to load
      }
    },
    
    // Error tracking settings
    errorTracking: {
      enabled: true,
      captureGlobalErrors: true,
      captureUnhandledRejections: true,
      // Fields to sanitize from error logs for privacy/security
      sanitizeFields: ['password', 'token', 'apiKey', 'secret'],
    },
    
    // User session tracking
    sessionTracking: {
      enabled: true,
      // Log user session data
      logSessionStart: true,
      logSessionEnd: true,
      // Include user agent info
      trackUserAgent: true,
      // Unique session ID generation
      sessionIdGenerator: () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    },
    
    // Network request logging
    networkLogging: {
      enabled: true,
      // Don't log request/response bodies in production to avoid leaking sensitive data
      logBodies: !IS_PRODUCTION,
      // Fields to redact from logged requests/responses
      redactFields: ['password', 'token', 'apiKey', 'secret'],
      // Maximum size of request/response body to log
      maxBodySize: 10000, // 10KB
      // Only log certain API endpoints
      filterEndpoints: IS_PRODUCTION,
      // Which endpoints to include when filtering
      includedEndpoints: ['/api/process', '/api/transcribe'],
    },
    
    // Voice and audio debugging
    audioDebugging: {
      enabled: IS_DEVELOPMENT,
      logMicrophoneAccess: true,
      logVoiceTranscriptions: true,
      // Log audio metrics like volume levels
      logAudioLevels: IS_DEVELOPMENT,
    },
    
    // Remote logging to a service (could be integrated with Sentry, LogRocket, etc.)
    remoteLogging: {
      enabled: IS_PRODUCTION,
      endpoint: '', // URL to send logs to
      batchLogs: true, // Send logs in batches
      batchSize: 10, // Number of logs per batch
      batchTimeMs: 5000, // Send batch every 5 seconds
      // Minimum level to send to remote service
      minimumLevel: LogLevel.ERROR,
      // Include additional context with remote logs
      includeContext: true,
    }
  };
  
  // Export a helper to check if a particular feature is enabled
  export function isFeatureEnabled(featurePath: string): boolean {
    const parts = featurePath.split('.');
    let config: any = loggingConfig;
    
    for (const part of parts) {
      if (config === undefined) return false;
      config = config[part];
    }
    
    return !!config;
  }
  
  // Export a helper to get log level for category
  export function getLogLevelForCategory(category: string): LogLevel {
    const categoryLevel = loggingConfig.categoryLogLevels[category as keyof typeof loggingConfig.categoryLogLevels];
    return categoryLevel !== undefined ? categoryLevel : loggingConfig.defaultLogLevel;
  }
  
  export default loggingConfig;