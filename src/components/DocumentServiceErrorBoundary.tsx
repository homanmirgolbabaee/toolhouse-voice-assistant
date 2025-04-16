'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Database } from 'lucide-react';

export default function DocumentServiceErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Check if localStorage is available and working
  useEffect(() => {
    try {
      // Test localStorage
      localStorage.setItem('notesai_test', 'test');
      localStorage.removeItem('notesai_test');
      setHasError(false);
    } catch (error) {
      console.error('LocalStorage is not available:', error);
      setHasError(true);
    }
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    // Retry after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
          <div className="mb-4 flex justify-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
              <Database size={32} />
            </div>
          </div>
          <h2 className="text-xl font-bold text-center mb-2">Storage Access Error</h2>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
            NotesAI couldn't access browser storage. This might be due to private browsing mode, 
            storage restrictions, or browser settings.
          </p>
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center"
            >
              {isRetrying ? (
                <>
                  <RefreshCw size={18} className="animate-spin mr-2" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw size={18} className="mr-2" />
                  Try Again
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}