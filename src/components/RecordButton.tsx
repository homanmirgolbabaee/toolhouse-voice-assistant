"use client";

interface RecordButtonProps {
  isRecording: boolean;
  onClick: () => void;
}

export default function RecordButton({ isRecording, onClick }: RecordButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-12 h-12 rounded-full flex items-center justify-center transition-all
        ${isRecording 
          ? 'bg-red-500 text-white animate-pulse' 
          : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'}
      `}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
    >
      {isRecording ? (
        <span className="text-xl">⬛</span> // Stop icon
      ) : (
        <span className="text-xl">🎤</span> // Microphone icon
      )}
    </button>
  );
}