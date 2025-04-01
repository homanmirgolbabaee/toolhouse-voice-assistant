/**
 * State tracking utilities for debugging React state changes
 */
import { useEffect, useRef } from 'react';
import logger from './logger';

/**
 * Hook to log state changes
 * @param name Name to identify the state in logs
 * @param state The state to track
 */
export function useStateLogger<T>(name: string, state: T): void {
  const prevStateRef = useRef<T>(state);
  
  useEffect(() => {
    // Skip initial render
    if (prevStateRef.current !== state) {
      const prevState = prevStateRef.current;
      prevStateRef.current = state;
      
      // Create a simplified representation for complex objects
      const simplifyValue = (value: any): any => {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        
        if (Array.isArray(value)) {
          if (value.length === 0) return '[]';
          return `Array(${value.length})`;
        }
        
        if (typeof value === 'object') {
          if (Object.keys(value).length === 0) return '{}';
          return '{' + Object.keys(value).join(', ') + '}';
        }
        
        if (typeof value === 'function') return 'function()';
        
        return value;
      };
      
      const simplifyForLogging = (obj: any): any => {
        if (typeof obj !== 'object' || obj === null) {
          return simplifyValue(obj);
        }
        
        if (Array.isArray(obj)) {
          return `Array(${obj.length})`;
        }
        
        const result: Record<string, any> = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = simplifyValue(obj[key]);
          }
        }
        return result;
      };
      
      logger.debug('state', `State change in ${name}`, {
        prev: simplifyForLogging(prevState),
        current: simplifyForLogging(state),
      });
    }
  }, [name, state]);
}

/**
 * Log props changes to help debug unnecessary renders
 * @param name Component name
 * @param props Component props
 */
export function usePropsLogger(name: string, props: Record<string, any>): void {
  const prevPropsRef = useRef<Record<string, any>>({});
  
  useEffect(() => {
    const prevProps = prevPropsRef.current;
    
    // Find changed props
    const changedProps: Record<string, { from: any, to: any }> = {};
    
    // Check added or changed props
    Object.keys(props).forEach(key => {
      if (props[key] !== prevProps[key]) {
        changedProps[key] = {
          from: prevProps[key],
          to: props[key]
        };
      }
    });
    
    // Check removed props
    Object.keys(prevProps).forEach(key => {
      if (!(key in props)) {
        changedProps[key] = {
          from: prevProps[key],
          to: undefined
        };
      }
    });
    
    // Update the ref
    prevPropsRef.current = { ...props };
    
    // If there are changed props, log them
    if (Object.keys(changedProps).length > 0) {
      logger.debug('state', `Props changed in ${name}`, changedProps);
    }
  });
}

/**
 * Hook to track render count of components
 * @param componentName Name of the component
 */
export function useRenderCount(componentName: string): number {
  const renderCount = useRef(0);
  
  renderCount.current += 1;
  
  useEffect(() => {
    logger.debug('state', `${componentName} rendered (count: ${renderCount.current})`);
  });
  
  return renderCount.current;
}

export default {
  useStateLogger,
  usePropsLogger,
  useRenderCount,
};