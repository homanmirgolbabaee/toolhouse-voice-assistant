/**
 * Performance monitoring utilities
 * Provides tools for tracking render performance and network operations
 */
import logger from './logger';

interface PerformanceEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

// Store ongoing measurements
const measurements: Record<string, PerformanceEntry> = {};

const performanceUtils = {
  /**
   * Start measuring a named operation
   */
  start: (name: string): void => {
    measurements[name] = {
      name,
      startTime: performance.now(),
    };
    logger.debug('performance', `Started measuring: ${name}`);
  },

  /**
   * End measuring a named operation and log the result
   */
  end: (name: string, logLevel: 'debug' | 'info' = 'debug'): number | null => {
    const measurement = measurements[name];
    if (!measurement) {
      logger.warn('performance', `No measurement found for: ${name}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - measurement.startTime;
    
    // Update the measurement
    measurements[name] = {
      ...measurement,
      endTime,
      duration,
    };

    // Log the result
    if (logLevel === 'info') {
      logger.info('performance', `${name} completed in ${duration.toFixed(2)}ms`);
    } else {
      logger.debug('performance', `${name} completed in ${duration.toFixed(2)}ms`);
    }

    return duration;
  },

  /**
   * Measure a function execution time
   */
  measure: async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
    performanceUtils.start(name);
    try {
      const result = await fn();
      performanceUtils.end(name);
      return result;
    } catch (error) {
      performanceUtils.end(name);
      throw error;
    }
  },

  /**
   * Get all measurements
   */
  getMeasurements: (): Record<string, PerformanceEntry> => {
    return { ...measurements };
  },

  /**
   * Clear all measurements
   */
  clear: (): void => {
    Object.keys(measurements).forEach(key => {
      delete measurements[key];
    });
  },
  
  /**
   * Get performance entries from the browser
   */
  getEntriesByType: (type: string): PerformanceEntry[] => {
    if (typeof window !== 'undefined' && window.performance && window.performance.getEntriesByType) {
      return window.performance.getEntriesByType(type) as unknown as PerformanceEntry[];
    }
    return [];
  }
};

/**
 * Decorator for measuring component render times
 * Usage: @measureRender('ComponentName')
 */
export function measureRender(componentName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const startTime = performance.now();
      const result = originalMethod.apply(this, args);
      
      // Handle both sync and async renders
      if (result && typeof result.then === 'function') {
        return result.then((resolvedResult: any) => {
          const duration = performance.now() - startTime;
          logger.debug('performance', `Render ${componentName}: ${duration.toFixed(2)}ms`);
          return resolvedResult;
        });
      } else {
        const duration = performance.now() - startTime;
        logger.debug('performance', `Render ${componentName}: ${duration.toFixed(2)}ms`);
        return result;
      }
    };

    return descriptor;
  };
}

export default performanceUtils;