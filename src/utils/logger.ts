/**
 * Centralized logger utility for the application
 * Provides consistent logging format with timestamps, categories, and log levels
 */
import { LogLevel, getLogLevelForCategory, loggingConfig } from '@/config/logging';

// Log categories to organize logs
export type LogCategory = 
  | 'api' 
  | 'voice' 
  | 'chat' 
  | 'ui' 
  | 'audio'
  | 'network'
  | 'state'
  | 'performance'
  | 'session'
  | 'global';

// Format the current time for the log message
const getTimestamp = (): string => {
  return new Date().toISOString();
};

// Add colors in development for better readability
const colorize = (level: LogLevel, message: string): string => {
  if (typeof window !== 'undefined' || !loggingConfig.console.useColors) {
    return message; // No colors in browser or if disabled
  }
  
  // Colors for terminal
  const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
  };

  switch (level) {
    case LogLevel.DEBUG:
      return `${colors.cyan}${message}${colors.reset}`;
    case LogLevel.INFO:
      return `${colors.green}${message}${colors.reset}`;
    case LogLevel.WARN:
      return `${colors.yellow}${message}${colors.reset}`;
    case LogLevel.ERROR:
      return `${colors.red}${message}${colors.reset}`;
    default:
      return message;
  }
};

// Truncate long strings to avoid console flooding
const truncateData = (data: any): any => {
  if (!data) return data;
  
  const maxLength = loggingConfig.console.truncateStringsLongerThan;
  
  if (typeof data === 'string' && data.length > maxLength) {
    return `${data.substring(0, maxLength)}... (truncated, ${data.length} total characters)`;
  }
  
  if (typeof data === 'object' && data !== null) {
    const result: Record<string, any> = Array.isArray(data) ? [] : {};
    
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = truncateData(data[key]);
      }
    }
    
    return result;
  }
  
  return data;
};

// Check if we should log this message based on level and category
const shouldLog = (level: LogLevel, category: LogCategory): boolean => {
  const categoryLevel = getLogLevelForCategory(category);
  return level >= categoryLevel;
};

// The actual log function that includes timestamp, category, and level
const log = (level: LogLevel, category: LogCategory, message: string, data?: any): void => {
  // Skip logging if we shouldn't log this category/level
  if (!shouldLog(level, category)) {
    return;
  }
  
  // Skip logging if console is disabled
  if (!loggingConfig.console.enabled) {
    return;
  }

  const timestamp = getTimestamp();
  const levelName = LogLevel[level];
  
  // Format the log message
  const logPrefix = loggingConfig.console.includeTimestamps
    ? `[${timestamp}] [${levelName}] [${category}]`
    : `[${levelName}] [${category}]`;
    
  const formattedMessage = colorize(level, `${logPrefix}: ${message}`);
  
  // Process data for logging
  const processedData = data ? truncateData(data) : undefined;
  
  // Log to the appropriate console method
  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formattedMessage, processedData ? processedData : '');
      break;
    case LogLevel.INFO:
      console.info(formattedMessage, processedData ? processedData : '');
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage, processedData ? processedData : '');
      break;
    case LogLevel.ERROR:
      console.error(formattedMessage, processedData ? processedData : '');
      break;
  }
  
  // Implement remote logging here if needed
  if (level >= LogLevel.ERROR && loggingConfig.remoteLogging.enabled) {
    // Code to send logs to remote service would go here
  }
};

// Create a batch for remote logging
const logBatch: Array<{ level: LogLevel; category: LogCategory; message: string; data?: any; timestamp: string }> = [];

// Export the logger with convenience methods
export const logger = {
  debug: (category: LogCategory, message: string, data?: any) => 
    log(LogLevel.DEBUG, category, message, data),
    
  info: (category: LogCategory, message: string, data?: any) => 
    log(LogLevel.INFO, category, message, data),
    
  warn: (category: LogCategory, message: string, data?: any) => 
    log(LogLevel.WARN, category, message, data),
    
  error: (category: LogCategory, message: string, data?: any) => 
    log(LogLevel.ERROR, category, message, data),
  
  // Performance logging helper
  performance: (category: LogCategory, label: string, startTime: number) => {
    const duration = performance.now() - startTime;
    log(LogLevel.DEBUG, category, `${label} took ${duration.toFixed(2)}ms`);
    
    // Check performance thresholds
    if (loggingConfig.performance.thresholds) {
      if (category === 'api' && 
          duration > loggingConfig.performance.thresholds.apiCallWarning) {
        log(LogLevel.WARN, 'performance', `Slow API call: ${label} took ${duration.toFixed(2)}ms`);
      }
      else if (category === 'ui' && 
               duration > loggingConfig.performance.thresholds.renderWarning) {
        log(LogLevel.WARN, 'performance', `Slow render: ${label} took ${duration.toFixed(2)}ms`);
      }
    }
  },
  
  // Group logs for related operations (helpful in browser console)
  group: (name: string) => {
    if (typeof console.group === 'function' && loggingConfig.console.enabled) {
      console.group(name);
    }
  },
  
  groupEnd: () => {
    if (typeof console.groupEnd === 'function' && loggingConfig.console.enabled) {
      console.groupEnd();
    }
  },
  
  // Create a named logger for a specific category
  createLogger: (category: LogCategory) => ({
    debug: (message: string, data?: any) => log(LogLevel.DEBUG, category, message, data),
    info: (message: string, data?: any) => log(LogLevel.INFO, category, message, data),
    warn: (message: string, data?: any) => log(LogLevel.WARN, category, message, data),
    error: (message: string, data?: any) => log(LogLevel.ERROR, category, message, data),
  })
};

export default logger;