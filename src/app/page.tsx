"use client";

import { useState, useEffect } from "react";
import VoiceAssistant from "@/components/VoiceAssistant";
import VoiceOnlyMode from "@/components/VoiceOnlyMode";
import ChatOnlyMode from "@/components/ChatOnlyMode";
import ModeSelector from "@/components/ModeSelector";
import { Settings } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import logger from "@/utils/logger";
import audioLogger from "@/utils/audioLogger";
import { useLogger } from "@/contexts/LoggerContext";
import performanceUtils from "@/utils/performance";

// Define the interaction modes
type InteractionMode = "selection" | "voice-only" | "chat-only" | "combined";

export default function Home() {
  const [mode, setMode] = useState<InteractionMode>("selection");
  const [activeMicId, setActiveMicId] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const { logNavigation, logEvent, logInteraction } = useLogger();

  // Log navigation to the page
  useEffect(() => {
    logger.info('session', 'Application started');
    logEvent('app', 'init', { 
      initialMode: mode, 
      timestamp: new Date().toISOString() 
    });
    
    // Performance metrics for page load
    if (typeof window !== 'undefined') {
      const navigationTiming = performanceUtils.getEntriesByType('navigation')[0];
      if (navigationTiming) {
        logger.info('performance', 'Page loaded', {
          loadTime: navigationTiming.duration,
          domContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.domContentLoadedEventStart,
          domComplete: navigationTiming.domComplete,
          redirectCount: navigationTiming.redirectCount,
          type: navigationTiming.type
        });
      }
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load available audio devices
  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        performanceUtils.start('load-audio-devices');
        logger.debug('audio', 'Loading audio devices');
        
        // Request microphone permission
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              // Stop the stream immediately after getting permission
              stream.getTracks().forEach(track => track.stop());
              audioLogger.logMicrophoneAccess(true);
            })
            .catch(err => {
              logger.error('audio', "Microphone permission denied:", err);
              audioLogger.logMicrophoneAccess(false, err);
              return;
            });
        } catch (error) {
          logger.error('audio', "Error requesting microphone access:", error);
          audioLogger.logMicrophoneAccess(false, error);
        }

        // Get list of devices
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === "audioinput");
          setAvailableMics(audioInputs);
          audioLogger.logDevices(audioInputs);
          
          // If no active mic is set but we have devices, set the default one
          if (!activeMicId && audioInputs.length > 0) {
            setActiveMicId(audioInputs[0].deviceId);
            audioLogger.logDeviceSelection(audioInputs[0].deviceId);
          }
          
          logger.debug('audio', `Found ${audioInputs.length} audio input devices`);
        } catch (error) {
          logger.error('audio', "Error enumerating devices:", error);
        }
        
        performanceUtils.end('load-audio-devices');
      } catch (err) {
        logger.error('audio', "Error in loadAudioDevices:", err);
      }
    };

    loadAudioDevices();

    // Listen for device changes (e.g., when new microphones are plugged in)
    const handleDeviceChange = async () => {
      logger.debug('audio', 'Media devices changed, reloading devices');
      await loadAudioDevices();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [activeMicId]);

  // Log mode changes
  useEffect(() => {
    if (mode !== 'selection') {
      logger.info('ui', `Mode changed to ${mode}`);
      logNavigation('selection', mode);
      
      logEvent('app', 'mode_change', { 
        mode, 
        micId: activeMicId || 'default'
      });
    }
  }, [mode, activeMicId, logNavigation, logEvent]);

  // Handle mode selection
  const handleModeSelect = (selectedMode: InteractionMode) => {
    const previousMode = mode;
    performanceUtils.start(`mode-change-${previousMode}-to-${selectedMode}`);
    
    setMode(selectedMode);
    logInteraction('mode-selector', 'select', { 
      previousMode,
      newMode: selectedMode
    });
    
    performanceUtils.end(`mode-change-${previousMode}-to-${selectedMode}`);
  };

  // Function to render the appropriate component based on mode
  const renderContent = () => {
    switch (mode) {
      case "voice-only":
        return (
          <ErrorBoundary componentName="VoiceOnlyMode">
            <VoiceOnlyMode activeMicId={activeMicId} />
          </ErrorBoundary>
        );
      case "chat-only":
        return (
          <ErrorBoundary componentName="ChatOnlyMode">
            <ChatOnlyMode />
          </ErrorBoundary>
        );
      case "combined":
        return (
          <ErrorBoundary componentName="VoiceAssistant">
            <VoiceAssistant activeMicId={activeMicId} />
          </ErrorBoundary>
        );
      default:
        return (
          <ErrorBoundary componentName="ModeSelector">
            <ModeSelector onSelectMode={handleModeSelect} />
          </ErrorBoundary>
        );
    }
  };

  // Helper to get a readable name for the device
  const getDeviceName = (device: MediaDeviceInfo) => {
    return device.label || `Microphone ${availableMics.indexOf(device) + 1}`;
  };

  // Handle microphone selection
  const handleMicSelect = (deviceId: string) => {
    const previousMicId = activeMicId;
    setActiveMicId(deviceId);
    setIsSettingsOpen(false);
    
    // Find device name for logging
    const device = availableMics.find(mic => mic.deviceId === deviceId);
    const deviceName = device ? getDeviceName(device) : deviceId;
    
    logger.info('audio', `Microphone changed: ${deviceName} (${deviceId})`);
    logEvent('audio', 'microphone_change', { 
      previousId: previousMicId,
      newId: deviceId,
      name: deviceName
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 text-foreground">
      <header className="sticky top-0 z-10 py-3 px-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Toolhouse Assistant
          </h1>
          
          <div className="flex items-center space-x-2">
            {/* Microphone settings button */}
            {(mode === "voice-only" || mode === "combined") && (
              <div className="relative">
                <button
                  onClick={() => {
                    setIsSettingsOpen(!isSettingsOpen);
                    logInteraction('microphone-settings', isSettingsOpen ? 'close' : 'open');
                  }}
                  className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Microphone Settings"
                  data-testid="mic-settings-button"
                >
                  <Settings size={16} />
                </button>
                
                {isSettingsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="font-medium text-sm">Microphone Settings</h3>
                      <button 
                        onClick={() => {
                          setIsSettingsOpen(false);
                          logInteraction('microphone-settings', 'close');
                        }}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        &times;
                      </button>
                    </div>

                    <div className="p-3">
                      {availableMics.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No microphones detected.</p>
                      ) : (
                        <ul className="space-y-1">
                          {availableMics.map((device) => (
                            <li key={device.deviceId}>
                              <button
                                onClick={() => handleMicSelect(device.deviceId)}
                                className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between ${
                                  activeMicId === device.deviceId
                                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                                data-device-id={device.deviceId}
                              >
                                <span className="truncate max-w-[180px]">{getDeviceName(device)}</span>
                                {activeMicId === device.deviceId && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Mode selector button */}
            {mode !== "selection" && (
              <button 
                onClick={() => {
                  setMode("selection");
                  logInteraction('change-mode-button', 'click');
                }}
                className="text-sm px-3 py-1 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                data-testid="change-mode-button"
              >
                Change Mode
              </button>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-6">
        {renderContent()}
      </main>
      
      <footer className="py-3 px-4 border-t border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Powered by Next.js, OpenAI, and Toolhouse</p>
        
        {/* Development mode footer content */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs mt-1">
            <span>Development Mode</span>
            {" | "}
            <button 
              onClick={() => {
                const appVersion = "1.1.0";
                const appBuild = Date.now().toString().substring(0, 10);
                logger.info('session', 'Debug info', {
                  version: appVersion,
                  build: appBuild,
                  mode,
                  activeMicId,
                  availableMics: availableMics.length,
                  userAgent: navigator.userAgent
                });
                logEvent('debug', 'show_info', { version: appVersion, build: appBuild });
                alert(`App v${appVersion} (${appBuild})\nMode: ${mode}\nMic: ${activeMicId}`);
              }}
              className="text-blue-500 hover:underline"
            >
              Debug Info
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}