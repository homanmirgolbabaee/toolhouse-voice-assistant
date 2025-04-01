"use client";

import { useState, useEffect } from "react";
import { Settings, Check, MicOff, Mic } from "lucide-react";

interface VoiceSettingsProps {
  activeMicId: string;
  setActiveMicId: (id: string) => void;
  className?: string;
}

export default function VoiceSettings({ activeMicId, setActiveMicId, className = "" }: VoiceSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    // Load available audio devices when component mounts or when the dropdown opens
    const loadAudioDevices = async () => {
      try {
        // Request microphone permission first
        await navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            // Stop the stream immediately after getting permission
            stream.getTracks().forEach(track => track.stop());
            setPermissionDenied(false);
          })
          .catch(err => {
            console.error("Microphone permission denied:", err);
            setPermissionDenied(true);
            return;
          });

        // Get list of devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === "audioinput");
        setAudioDevices(audioInputs);
        
        // If no active mic is set but we have devices, set the default one
        if (!activeMicId && audioInputs.length > 0) {
          setActiveMicId(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Error loading audio devices:", err);
      }
    };

    if (isOpen) {
      loadAudioDevices();
    }
  }, [isOpen, activeMicId, setActiveMicId]);

  // Helper to get a readable name for the device
  const getDeviceName = (device: MediaDeviceInfo) => {
    return device.label || `Microphone ${audioDevices.indexOf(device) + 1}`;
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Microphone Settings"
      >
        <Settings size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-64 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-medium text-sm">Microphone Settings</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              &times;
            </button>
          </div>

          <div className="p-3">
            {permissionDenied ? (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <MicOff size={16} />
                <p>Microphone access denied. Please enable it in your browser settings.</p>
              </div>
            ) : audioDevices.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No microphones detected.</p>
            ) : (
              <ul className="space-y-1">
                {audioDevices.map((device) => (
                  <li key={device.deviceId}>
                    <button
                      onClick={() => {
                        setActiveMicId(device.deviceId);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between ${
                        activeMicId === device.deviceId
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Mic size={14} />
                        <span className="truncate max-w-[160px]">{getDeviceName(device)}</span>
                      </div>
                      {activeMicId === device.deviceId && <Check size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}