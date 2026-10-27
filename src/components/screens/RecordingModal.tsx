import React, { useEffect, useState } from 'react';
import { Mic, Square, X, AlertCircle, Volume2, ShieldAlert } from 'lucide-react';
import { Sentence, ReviewAudioData } from '../../types';
import { formatSentenceId, formatDuration } from '../../utils/formatters';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { WaveformVisualizer } from '../WaveformVisualizer';

interface RecordingModalProps {
  sentence: Sentence;
  onRecordingComplete: (reviewData: ReviewAudioData) => void;
  onClose: () => void;
}

export const RecordingModal: React.FC<RecordingModalProps> = ({
  sentence,
  onRecordingComplete,
  onClose,
}) => {
  const {
    state,
    duration,
    error,
    analyserNode,
    startRecording,
    stopRecording,
    cancelRecording,
    resetError,
  } = useAudioRecorder();

  const [hasStarted, setHasStarted] = useState(false);
  const displayId = sentence.id || formatSentenceId(sentence.level, sentence.sentenceNumber);

  // Clean exit if user closes modal
  const handleClose = () => {
    cancelRecording();
    onClose();
  };

  const handleStart = async () => {
    resetError();
    const ok = await startRecording();
    if (ok) {
      setHasStarted(true);
    }
  };

  const handleStop = async () => {
    const rawBlob = await stopRecording();
    if (rawBlob && rawBlob.size > 0) {
      onRecordingComplete({
        tempBlob: rawBlob,
        sentence,
        duration,
        sampleRate: 16000,
        channelCount: 1,
        bitDepth: 16,
      });
    }
  };

  const handleCancel = () => {
    cancelRecording();
    setHasStarted(false);
    onClose();
  };

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const isRequesting = state === 'requesting_permission';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-white border border-teal-100 p-5 md:p-6 shadow-2xl flex flex-col space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/80">
              {displayId}
            </span>
            <span className="text-xs font-semibold text-slate-700">
              {sentence.difficultyLevel || `Level ${sentence.level}`}
            </span>
            {sentence.category && (
              <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium border border-teal-200/60">
                {sentence.category}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isRecording}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-30"
            aria-label="Close recording session"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sentence Text Prompt (Prominent for clear clinical articulation) */}
        <div className="p-5 rounded-2xl bg-teal-50/60 border border-teal-100/90 text-center shadow-xs">
          <p className="text-[11px] text-teal-700 uppercase tracking-wider mb-2 font-bold">
            Read aloud into microphone:
          </p>
          <p className="text-xl md:text-2xl font-bold text-slate-900 leading-relaxed tracking-normal select-none">
            "{sentence.text}"
          </p>
          {sentence.instructionNotes && (
            <p className="text-sm md:text-base text-slate-600 font-medium mt-2 select-none">
              ({sentence.instructionNotes})
            </p>
          )}
        </div>

        {/* Real-time Waveform & Audio Meter */}
        <div className="space-y-1.5">
          <WaveformVisualizer
            analyserNode={analyserNode}
            isRecording={isRecording}
            height={64}
          />

          <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 font-medium text-teal-700">
              <Volume2 className="w-4 h-4 text-teal-600" />
              <span>Acoustic Input (16kHz PCM)</span>
            </span>

            {/* Live recording timer */}
            <span
              className={`font-mono text-sm font-bold tabular-nums ${
                isRecording ? 'text-rose-600 animate-pulse' : 'text-slate-600'
              }`}
            >
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Recording Status Message */}
        <div className="text-center py-1">
          {state === 'idle' && !hasStarted && (
            <p className="text-xs text-slate-500">
              Tap the microphone button below when ready to speak.
            </p>
          )}
          {isRequesting && (
            <p className="text-xs text-amber-600 font-semibold animate-pulse">
              Requesting microphone permission...
            </p>
          )}
          {isRecording && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              <span>Recording clinical audio take...</span>
            </div>
          )}
          {isProcessing && (
            <p className="text-xs text-teal-700 font-semibold animate-pulse">
              Processing & encoding audio...
            </p>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-rose-900">Microphone Issue</p>
              <p className="text-rose-800/90 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="pt-2 flex items-center justify-center gap-4">
          {!isRecording ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={isRequesting || isProcessing}
              className="min-h-[54px] px-8 rounded-full bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white font-bold text-sm flex items-center gap-2.5 shadow-lg shadow-teal-600/30 transition active:scale-95 disabled:opacity-50"
            >
              <Mic className="w-5 h-5" />
              <span>Start Recording</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 min-h-[48px] rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition active:scale-95 border border-slate-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleStop}
                className="flex-2 min-h-[48px] rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition active:scale-95"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop & Review</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
