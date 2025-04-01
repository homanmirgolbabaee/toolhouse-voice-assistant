/**
 * Error tracking utility
 * 
 * Provides centralized error handling, tracking, and reporting capabilities.
 * This can be connected to error monitoring services like Sentry, LogRocket, etc.
 */
import logger from './logger';
import { loggingConfig } from '@/config/logging';

// Maximum number of errors to store locally
const MAX_STORED_ERRORS = 50;

// Store recent errors
interface TrackedError {
  id: string;
  timestamp: Date;
  message: string;
  stack?: string;
  componentName?: string;
  context?: any;
  url: string;
  userAgent: string;
}

// Store errors in memory for debugging
const recentErrors: TrackedError[] = [];

// Error tracking utility
const errorTracker = {
  /**
   * Initialize error tracking
   */
  init: () => {
    if (!loggingConfig.errorTracking.enabled) return;
    
    // Handle unhandled errors
    if (loggingConfig.errorTracking.captureGlobalErrors && typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        errorTracker.trackError(
          event.error || new Error(event.message),
          'GlobalErrorHandler',
          {
            fileName: event.filename,
            lineNumber: event.lineno,
            columnNumber: event.colno,
            type: 'unhandled'
          }
        );
        
        // Don't prevent default handling
        return false;
      });
    }
    
    // Handle unhandled promise rejections
    if (loggingConfig.errorTracking.captureUnhandledRejections && typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason) || 'Unhandled Promise Rejection');
        
        errorTracker.trackError(
          error,
          'UnhandledRejection',
          {
            type: 'unhandledrejection',
            promise: event.promise
          }
        );
        
        // Don't prevent default handling
        return false;
      });
    }
    
    logger.debug('global', 'Error tracking initialized');
  },
  
  /**
   * Track an error
   */
  trackError: (
    error: Error, 
    componentName: string = 'Unknown', 
    context: any = {}
  ): string => {
    // Generate a unique ID for this error
    const errorId = `err-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create the error record
    const trackedError: TrackedError = {
      id: errorId,
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      componentName,
      context,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    };
    
    // Log the error
    logger.error('global', `Error in ${componentName}: ${error.message}`, {
      errorId,
      stack: error.stack,
      ...context
    });
    
    // Store the error
    recentErrors.unshift(trackedError);
    
    // Keep only the most recent errors
    if (recentErrors.length > MAX_STORED_ERRORS) {
      recentErrors.pop();
    }
    
    // Send to remote error tracking service (if in production)
    if (process.env.NODE_ENV === 'production' && loggingConfig.remoteLogging.enabled) {
      errorTracker.sendToRemoteService(trackedError);
    }
    
    return errorId;
  },
  
  /**
   * Send error to remote service (e.g., Sentry, LogRocket, etc.)
   * This is a placeholder - you would implement the actual service integration here
   */
  sendToRemoteService: (error: TrackedError): void => {
    // Example implementation for a generic error tracking service
    // In a real application, you would use the SDK of your error tracking service
    
    // Sanitize sensitive data
    const sanitizedContext = error.context ? sanitizeErrorData(error.context) : undefined;
    
    // Mock sending to service
    console.info('Would send error to remote service:', {
      ...error,
      context: sanitizedContext
    });
    
    // Example integration with a hypothetical error service:
    /*
    ErrorService.captureException(new Error(error.message), {
      tags: {
        component: error.componentName
      },
      extra: sanitizedContext,
      fingerprint: [error.componentName, error.message]
    });
    */
  },
  
  /**
   * Get recent errors (for debugging purposes)
   */
  getRecentErrors: (): TrackedError[] => {
    return [...recentErrors];
  },
  
  /**
   * Clear stored errors
   */
  clearErrors: (): void => {
    recentErrors.length = 0;
  },
  
  /**
   * Get error by ID
   */
  getErrorById: (errorId: string): TrackedError | undefined => {
    return recentErrors.find(err => err.id === errorId);
  }
};

/**
 * Sanitize error data to remove sensitive information
 */
function sanitizeErrorData(data: any): any {
  if (!data) return data;
  
  // Fields to sanitize
  const sensitiveFields = loggingConfig.errorTracking.sanitizeFields || [
    'password', 'token', 'apiKey', 'secret', 'authentication'
  ];
  
  // If it's not an object, return as is
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeErrorData(item));
  }
  
  // Clone the object to avoid modifying the original
  const sanitized = { ...data };
  
  // Check each field
  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      // Check if this is a sensitive field
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeErrorData(sanitized[key]);
      }
    }
  }
  
  return sanitized;
}

export default errorTracker;