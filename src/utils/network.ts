/**
 * Network monitoring utilities
 * Enhanced fetch with logging, error handling, and performance tracking
 */
import logger from './logger';
import performance from './performance';

interface FetchOptions extends RequestInit {
  timeout?: number;
  retry?: number;
  retryDelay?: number;
}

interface EnhancedResponse<T> extends Response {
  data?: T;
}

/**
 * Enhanced fetch function with logging, timeout, and retry capabilities
 */
export async function enhancedFetch<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<EnhancedResponse<T>> {
  const {
    timeout = 30000, // Default timeout: 30 seconds
    retry = 0, // Default retries: 0
    retryDelay = 1000, // Default delay between retries: 1 second
    ...fetchOptions
  } = options;

  // Generate a unique ID for this request for correlation in logs
  const requestId = Math.random().toString(36).substring(2, 9);
  
  // Log the request
  logger.debug('network', `[${requestId}] Request: ${fetchOptions.method || 'GET'} ${url}`, {
    headers: fetchOptions.headers,
    body: fetchOptions.body ? 
      (typeof fetchOptions.body === 'string' ? 
        fetchOptions.body.length > 1000 ? `${fetchOptions.body.substring(0, 1000)}... (truncated)` : fetchOptions.body
        : '[non-string body]') 
      : undefined
  });

  // Start performance measurement
  performance.start(`fetch-${requestId}`);

  // Create a promise that rejects after the timeout
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);
  });

  // Recursive function to handle retries
  const fetchWithRetry = async (attemptsLeft: number): Promise<Response> => {
    try {
      // Race between the fetch and the timeout
      const response = await Promise.race([
        fetch(url, fetchOptions),
        timeoutPromise
      ]);

      // Log the response
      logger.debug('network', `[${requestId}] Response: ${response.status} ${response.statusText}`);
      
      // If response is not ok and we have retries left, retry
      if (!response.ok && attemptsLeft > 0) {
        logger.warn('network', `[${requestId}] Retrying request (${attemptsLeft} attempts left): ${response.status} ${response.statusText}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchWithRetry(attemptsLeft - 1);
      }

      return response;
    } catch (error) {
      // If there's an error and we have retries left, retry
      if (attemptsLeft > 0) {
        logger.warn('network', `[${requestId}] Retrying after error (${attemptsLeft} attempts left): ${(error as Error).message}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchWithRetry(attemptsLeft - 1);
      }
      
      // Log the error
      logger.error('network', `[${requestId}] Request failed: ${(error as Error).message}`);
      throw error;
    }
  };

  try {
    // Execute the fetch with retry logic
    const response = await fetchWithRetry(retry);
    
    // Parse the response if it's JSON
    const contentType = response.headers.get('content-type');
    let data: T | undefined = undefined;
    
    if (contentType && contentType.includes('application/json')) {
      try {
        const json = await response.clone().json();
        data = json as T;
        
        // Log the data (truncated if too large)
        const stringifiedData = JSON.stringify(data);
        logger.debug('network', `[${requestId}] Response data:`, 
          stringifiedData.length > 1000 ? 
            `${stringifiedData.substring(0, 1000)}... (truncated)` : 
            data
        );
      } catch (error) {
        logger.warn('network', `[${requestId}] Failed to parse JSON response: ${(error as Error).message}`);
      }
    }

    // End performance measurement
    performance.end(`fetch-${requestId}`);
    
    // Return enhanced response with parsed data
    const enhancedResponse = response as EnhancedResponse<T>;
    enhancedResponse.data = data;
    return enhancedResponse;
  } catch (error) {
    // End performance measurement even if there's an error
    performance.end(`fetch-${requestId}`);
    
    // Rethrow the error
    throw error;
  }
}

/**
 * Utility function for JSON requests
 */
export function jsonFetch<T = any>(url: string, options: FetchOptions = {}): Promise<T> {
  // Set default headers for JSON
  const jsonOptions: FetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  };

  // If the body is an object, stringify it
  if (jsonOptions.body && typeof jsonOptions.body === 'object') {
    jsonOptions.body = JSON.stringify(jsonOptions.body);
  }

  return enhancedFetch<T>(url, jsonOptions)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      return response.data as T;
    });
}

export default {
  fetch: enhancedFetch,
  json: jsonFetch,
};