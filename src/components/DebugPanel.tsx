"use client";

import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Clock, Activity, Bug, Cpu, Zap } from 'lucide-react';

// Log entry structure
interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: any;
}

// Debug panel props
interface DebugPanelProps {
  showOnlyInDevelopment?: boolean;
}

// Debug panel state
interface StateSnapshot {
  name: string;
  value: any;
  timestamp: Date;
}

export default function DebugPanel({ showOnlyInDevelopment = true }: DebugPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'state' | 'network' | 'performance'| 'audio'>('logs');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stateSnapshots, setStateSnapshots] = useState<StateSnapshot[]>([]);
  const [networkCalls, setNetworkCalls] = useState<any[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);
  // Initialize the panel
  useEffect(() => {
    // Only show in development mode if showOnlyInDevelopment is true
    if (showOnlyInDevelopment && process.env.NODE_ENV !== 'development') {
      return;
    }

    // Override console methods to capture logs
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    // Helper to extract category from log message
    const extractCategory = (message: string): string => {
      const match = message.match(/\[([^\]]+)\]/);
      return match ? match[1] : 'general';
    };

    // Helper to create a log entry
    const createLogEntry = (level: 'debug' | 'info' | 'warn' | 'error', args: any[]): LogEntry => {
      const message = args[0]?.toString() || '';
      return {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date(),
        level,
        category: extractCategory(message),
        message,
        data: args.length > 1 ? args.slice(1) : undefined,
      };
    };

    // Override console methods
    console.debug = (...args: any[]) => {
      const logEntry = createLogEntry('debug', args);
      setLogs(prev => [...prev, logEntry]);
      originalConsole.debug(...args);
    };

    console.log = (...args: any[]) => {
      const logEntry = createLogEntry('info', args);
      setLogs(prev => [...prev, logEntry]);
      originalConsole.log(...args);
    };

    console.info = (...args: any[]) => {
      const logEntry = createLogEntry('info', args);
      setLogs(prev => [...prev, logEntry]);
      originalConsole.info(...args);
    };

    console.warn = (...args: any[]) => {
      const logEntry = createLogEntry('warn', args);
      setLogs(prev => [...prev, logEntry]);
      originalConsole.warn(...args);
    };

    console.error = (...args: any[]) => {
      const logEntry = createLogEntry('error', args);
      setLogs(prev => [...prev, logEntry]);
      originalConsole.error(...args);
    };

    // Monitor fetch calls using a combination of prototype override
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      const method = init?.method || 'GET';
      
      // Record the start of the request
      const startTime = performance.now();
      const requestId = Math.random().toString(36).substring(2, 9);
      
      const networkCall = {
        id: requestId,
        url,
        method,
        timestamp: new Date(),
        startTime,
        endTime: null as number | null,
        duration: null as number | null,
        status: null as number | null,
        statusText: null as string | null,
        error: null as string | null,
      };
      
      setNetworkCalls(prev => [...prev, networkCall]);
      
      try {
        const response = await originalFetch(input, init);
        
        // Update the network call with response details
        const endTime = performance.now();
        networkCall.endTime = endTime;
        networkCall.duration = endTime - startTime;
        networkCall.status = response.status;
        networkCall.statusText = response.statusText;
        
        setNetworkCalls(prev => 
          prev.map(call => call.id === requestId ? networkCall : call)
        );
        
        return response;
      } catch (error) {
        // Update the network call with error details
        const endTime = performance.now();
        networkCall.endTime = endTime;
        networkCall.duration = endTime - startTime;
        networkCall.error = (error as Error).message;
        
        setNetworkCalls(prev => 
          prev.map(call => call.id === requestId ? networkCall : call)
        );
        
        throw error;
      }
    };

    // Simple performance observer
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const metrics = entries.map(entry => ({
          id: Math.random().toString(36).substring(2, 9),
          name: entry.name,
          startTime: entry.startTime,
          duration: entry.duration,
          entryType: entry.entryType,
          timestamp: new Date(),
        }));
        
        setPerformanceMetrics(prev => [...prev, ...metrics]);
      });
      
      observer.observe({ entryTypes: ['resource', 'navigation', 'mark', 'measure'] });
    }

    // Key binding to toggle the panel (Ctrl+Shift+D)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
      window.fetch = originalFetch;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showOnlyInDevelopment]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  // Filter logs based on the search term
  const filteredLogs = logs.filter(log => {
    const searchTerm = filter.toLowerCase();
    return (
      log.message.toLowerCase().includes(searchTerm) ||
      log.category.toLowerCase().includes(searchTerm) ||
      (log.data && JSON.stringify(log.data).toLowerCase().includes(searchTerm))
    );
  });

  // If not in development mode and showOnlyInDevelopment is true, don't render
  if (showOnlyInDevelopment && process.env.NODE_ENV !== 'development') {
    return null;
  }

  // If panel is not visible, just show the toggle button
  if (!isVisible) {
    return (
      <button
        className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-full p-3 shadow-lg z-50 hover:bg-blue-700 transition-colors"
        onClick={() => setIsVisible(true)}
        title="Toggle Debug Panel (Ctrl+Shift+D)"
      >
        <Bug size={20} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bug size={20} className="text-blue-600" />
            Debug Panel
          </h2>
          <div className="flex items-center gap-2">
            <button
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={() => setIsVisible(false)}
              title="Close (Ctrl+Shift+D)"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'logs'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
            onClick={() => setActiveTab('logs')}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              Logs ({logs.length})
            </div>
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'network'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
            onClick={() => setActiveTab('network')}
          >
            <div className="flex items-center gap-2">
              <Zap size={16} />
              Network ({networkCalls.length})
            </div>
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'performance'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
            onClick={() => setActiveTab('performance')}
          >
            <div className="flex items-center gap-2">
              <Activity size={16} />
              Performance
            </div>
          </button>
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === 'state'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
            onClick={() => setActiveTab('audio')}
          >
            <div className="flex items-center gap-2">
              <Cpu size={16} />
              State
            </div>
          </button>
        </div>
        
        {/* Search bar */}
        {activeTab === 'logs' && (
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              placeholder="Filter logs..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'logs' && (
            <div className="h-full overflow-auto">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <AlertCircle size={32} className="mb-2" />
                  <p>No logs to display{filter ? ' matching your filter' : ''}.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2 ${
                        log.level === 'error'
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : log.level === 'warn'
                          ? 'bg-yellow-50 dark:bg-yellow-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-900/20'
                      }`}
                    >
                      <div className="flex items-start">
                        <div className="flex-none w-24 text-xs text-gray-500 dark:text-gray-400">
                          {log.timestamp.toLocaleTimeString()}
                        </div>
                        <div className="flex-none w-16">
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded-md ${
                              log.level === 'error'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                                : log.level === 'warn'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                                : log.level === 'info'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
                            }`}
                          >
                            {log.level}
                          </span>
                        </div>
                        <div className="flex-none w-24 px-1 text-xs">
                          <span
                            className="px-1.5 py-0.5 text-xs rounded-md bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300"
                          >
                            {log.category}
                          </span>
                        </div>
                        <div className="flex-1 ml-2 overflow-hidden">
                          <div className="text-sm break-words">{log.message}</div>
                          {log.data && (
                            <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-900 p-1 rounded overflow-auto max-h-32">
                              {typeof log.data === 'string'
                                ? log.data
                                : JSON.stringify(log.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'network' && (
            <div className="h-full overflow-auto">
              {networkCalls.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <Zap size={32} className="mb-2" />
                  <p>No network calls recorded yet.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        URL
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {networkCalls.map((call) => (
                      <tr
                        key={call.id}
                        className={
                          call.error
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : call.status && call.status >= 400
                            ? 'bg-yellow-50 dark:bg-yellow-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-900/20'
                        }
                      >
                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                          {call.timestamp.toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">
                          <span
                            className={`px-2 py-1 text-xs rounded-md ${
                              call.method === 'GET'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                                : call.method === 'POST'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                                : call.method === 'PUT'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                                : call.method === 'DELETE'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
                            }`}
                          >
                            {call.method}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm truncate max-w-xs">
                          {call.url}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {call.error ? (
                            <span className="text-red-600 dark:text-red-400">Error: {call.error}</span>
                          ) : call.status ? (
                            <span
                              className={`px-2 py-1 text-xs rounded-md ${
                                call.status < 300
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                                  : call.status < 400
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                                  : call.status < 500
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                              }`}
                            >
                              {call.status} {call.statusText}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">Pending...</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {call.duration ? (
                            <span
                              className={`${
                                call.duration < 100
                                  ? 'text-green-600 dark:text-green-400'
                                  : call.duration < 500
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {call.duration.toFixed(2)}ms
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          
          {activeTab === 'performance' && (
            <div className="h-full overflow-auto">
              {performanceMetrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <Activity size={32} className="mb-2" />
                  <p>No performance metrics recorded yet.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {performanceMetrics.map((metric) => (
                      <tr key={metric.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                          {metric.timestamp.toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`px-2 py-1 text-xs rounded-md ${
                              metric.entryType === 'navigation'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                                : metric.entryType === 'resource'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                                : metric.entryType === 'mark'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                            }`}
                          >
                            {metric.entryType}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm truncate max-w-xs">
                          {metric.name}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`${
                              metric.duration < 100
                                ? 'text-green-600 dark:text-green-400'
                                : metric.duration < 500
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {metric.duration.toFixed(2)}ms
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          
          {activeTab === 'state' && (
            <div className="h-full overflow-auto p-4">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-md mb-4">
                <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                  To track state changes, use the <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">useStateLogger</code> hook in your components.
                  Import it from <code className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">@/utils/stateLogger</code>.
                </p>
              </div>
              
              {stateSnapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                  <Cpu size={32} className="mb-2" />
                  <p>No state changes recorded yet.</p>
                  <p className="text-sm mt-2">
                    Add <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">useStateLogger('stateName', state)</code> to your components.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {stateSnapshots.map((snapshot) => (
                    <div key={`${snapshot.name}-${snapshot.timestamp.getTime()}`} className="py-2">
                      <div className="flex items-center">
                        <div className="w-1/4">
                          <span className="font-medium">{snapshot.name}</span>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {snapshot.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="w-3/4">
                          <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto max-h-32">
                            {typeof snapshot.value === 'object'
                              ? JSON.stringify(snapshot.value, null, 2)
                              : String(snapshot.value)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Press Ctrl+Shift+D to toggle this panel</span>
            <button
              className="text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => {
                // Clear all data
                setLogs([]);
                setNetworkCalls([]);
                setPerformanceMetrics([]);
                setStateSnapshots([]);
              }}
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}