import React, { useState } from 'react';
import { Check, RotateCcw, Trash2, Send, CheckCircle2, AlertCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { ReviewAudioData } from '../../types';
import { formatSentenceId, formatDuration, formatFileSize } from '../../utils/formatters';
import { AudioPlayer } from '../AudioPlayer';

interface ReviewModalProps {
  reviewData: ReviewAudioData;
  onSubmit: (data: ReviewAudioData) => Promise<void>;
  onRetake: () => void;
  onDiscard: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  reviewData,
  onSubmit,
  onRetake,
  onDiscard,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { sentence, tempBlob, duration } = reviewData;
  const displayId = sentence.promptId || sentence.id || formatSentenceId(sentence.level, sentence.sentenceNumber);

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    setSubmitProgress(20);

    try {
      // Simulate stepped upload & encoding progress
      const p1 = setTimeout(() => setSubmitProgress(55), 250);
      const p2 = setTimeout(() => setSubmitProgress(85), 500);

      await onSubmit(reviewData);

      clearTimeout(p1);
      clearTimeout(p2);
      setSubmitProgress(100);
      setSubmitSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to submit recording take.');
      }
      setSubmitting(false);
      setSubmitProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-white border border-teal-100 p-5 md:p-6 shadow-2xl flex flex-col space-y-4">
        {/* Header */}
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

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
            <span>{formatDuration(duration)}</span>
            <span>·</span>
            <span>{formatFileSize(tempBlob.size)}</span>
          </div>
        </div>

        {/* Sentence Text */}
        <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-100/90 text-center shadow-xs">
          <p className="text-[11px] text-teal-700 uppercase tracking-wider mb-1 font-bold">
            Recorded Speech Prompt
          </p>
          <p className="text-lg font-bold text-slate-900 leading-relaxed">
            "{sentence.text}"
          </p>
          {sentence.instructionNotes && (
            <p className="text-xs md:text-sm text-slate-600 font-medium mt-1.5">
              ({sentence.instructionNotes})
            </p>
          )}
        </div>

        {/* Audio Player */}
        <div>
          <AudioPlayer audioBlob={tempBlob} showDetails={true} />
        </div>

        {/* Upload Progress Bar */}
        {submitting && !submitSuccess && (
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>Encoding 16kHz PCM WAV & Saving Take...</span>
              <span className="font-mono font-bold text-teal-700">{submitProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${submitProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Status or Error Notifications */}
        {submitSuccess ? (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-emerald-900">Recording Submitted Successfully!</p>
              <p className="text-emerald-700 text-[11px] mt-0.5">
                Saved in sandboxed local storage (16kHz PCM WAV). Level sequence will advance to next prompt.
              </p>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500 text-center">
            Review your audio above. You can retake the prompt if needed, or submit to record this take and advance.
          </p>
        )}

        {/* Action Controls: Discard, Retake, Submit */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onDiscard}
            disabled={submitting || submitSuccess}
            className="flex-1 min-h-[44px] rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 border border-slate-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>

          <button
            type="button"
            onClick={onRetake}
            disabled={submitting || submitSuccess}
            className="flex-1 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 border border-slate-200"
            title="Retake keeps previous attempts and records a new take for the same assigned prompt"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake Prompt</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || submitSuccess}
            className="flex-2 min-h-[44px] rounded-xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition active:scale-95 disabled:opacity-50"
          >
            {submitting ? (
              <span>Submitting Take...</span>
            ) : submitSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Submitted!</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Recording</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
