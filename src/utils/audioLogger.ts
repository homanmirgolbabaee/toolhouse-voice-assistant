/**
 * Audio logging utilities for debugging voice interactions
 */
import logger from './logger';
import { isFeatureEnabled } from '@/config/logging';

// Interface for audio level data
interface AudioLevelData {
  timestamp: number;
  level: number;
  peak: number;
  average: number;
}

// Keep track of recent audio levels for debugging
const recentAudioLevels: AudioLevelData[] = [];
const MAX_AUDIO_LEVEL_ENTRIES = 100;

// Store information about available audio devices
interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  kind: string;
  isDefault: boolean;
  firstDetected: Date;
  lastSelected?: Date;
}

// Track detected audio devices
const detectedAudioDevices: Record<string, AudioDeviceInfo> = {};

const audioLogger = {
  /**
   * Log information about microphone access 
   */
  logMicrophoneAccess: (success: boolean, error?: any): void => {
    if (!isFeatureEnabled('audioDebugging.logMicrophoneAccess')) return;
    
    if (success) {
      logger.info('audio', 'Microphone access granted');
    } else {
      logger.error('audio', 'Microphone access denied', { error });
    }
  },

  /**
   * Log detected audio devices
   */
  logDevices: (devices: MediaDeviceInfo[]): void => {
    if (!isFeatureEnabled('audioDebugging.enabled')) return;
    
    const now = new Date();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    // Update our detected devices record
    audioInputs.forEach(device => {
      const deviceId = device.deviceId;
      const isNewDevice = !detectedAudioDevices[deviceId];
      
      if (isNewDevice) {
        detectedAudioDevices[deviceId] = {
          deviceId,
          label: device.label || `Unnamed Device (${deviceId.substring(0, 8)}...)`,
          kind: device.kind,
          isDefault: deviceId === 'default',
          firstDetected: now
        };
      }
    });
    
    logger.debug('audio', `Detected ${audioInputs.length} audio input devices`, {
      devices: audioInputs.map(d => ({
        id: d.deviceId,
        label: d.label,
        kind: d.kind
      }))
    });
  },

  /**
   * Log when a device is selected
   */
  logDeviceSelection: (deviceId: string): void => {
    if (!isFeatureEnabled('audioDebugging.enabled')) return;
    
    const device = detectedAudioDevices[deviceId];
    const now = new Date();
    
    if (device) {
      device.lastSelected = now;
      logger.info('audio', `Selected audio device: ${device.label} (${deviceId})`);
    } else {
      // Unknown device, add it to our records
      detectedAudioDevices[deviceId] = {
        deviceId,
        label: `Unknown Device (${deviceId.substring(0, 8)}...)`,
        kind: 'audioinput',
        isDefault: false,
        firstDetected: now,
        lastSelected: now
      };
      logger.info('audio', `Selected unknown audio device: ${deviceId}`);
    }
  },

  /**
   * Log audio level data for voice detection debugging
   */
  logAudioLevel: (level: number, peak?: number, average?: number): void => {
    if (!isFeatureEnabled('audioDebugging.logAudioLevels')) return;
    
    // Only log occasionally to avoid flooding the logs
    const shouldLog = Math.random() < 0.05; // Log roughly 5% of the time
    
    const data: AudioLevelData = {
      timestamp: Date.now(),
      level,
      peak: peak || level,
      average: average || level
    };
    
    // Store the level data
    recentAudioLevels.unshift(data);
    if (recentAudioLevels.length > MAX_AUDIO_LEVEL_ENTRIES) {
      recentAudioLevels.pop();
    }
    
    // Occasionally log the level
    if (shouldLog) {
      logger.debug('audio', `Audio level: ${level.toFixed(2)}`, { peak, average });
    }
  },

  /**
   * Log recorded audio information
   */
  logRecordingStart: (deviceId?: string): void => {
    if (!isFeatureEnabled('audioDebugging.enabled')) return;
    
    const device = deviceId ? detectedAudioDevices[deviceId] : undefined;
    logger.info('audio', 'Recording started', {
      deviceId,
      deviceLabel: device?.label || 'Unknown device',
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log recording stop event
   */
  logRecordingStop: (durationMs: number, audioSize: number): void => {
    if (!isFeatureEnabled('audioDebugging.enabled')) return;
    
    logger.info('audio', 'Recording stopped', {
      durationMs,
      durationFormatted: `${(durationMs / 1000).toFixed(1)}s`,
      audioSize,
      audioSizeFormatted: `${(audioSize / 1024).toFixed(1)}KB`,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log transcription results
   */
  logTranscription: (text: string, success: boolean, durationMs?: number): void => {
    if (!isFeatureEnabled('audioDebugging.logVoiceTranscriptions')) return;
    
    if (success) {
      logger.info('audio', 'Transcription success', {
        textLength: text.length,
        text: text.length > 100 ? `${text.substring(0, 100)}...` : text,
        durationMs,
        durationFormatted: durationMs ? `${(durationMs / 1000).toFixed(1)}s` : undefined
      });
    } else {
      logger.warn('audio', 'Transcription failed or empty', {
        text,
        durationMs
      });
    }
  },

  /**
   * Log audio error
   */
  logError: (errorType: string, error: any): void => {
    logger.error('audio', `Audio error: ${errorType}`, error);
  },

  /**
   * Get recent audio level data for debugging
   */
  getRecentAudioLevels: (): AudioLevelData[] => {
    return [...recentAudioLevels];
  },

  /**
   * Get information about detected audio devices
   */
  getDetectedDevices: (): Record<string, AudioDeviceInfo> => {
    return { ...detectedAudioDevices };
  }
};

export default audioLogger;