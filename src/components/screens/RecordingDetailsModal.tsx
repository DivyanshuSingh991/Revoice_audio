import React, { useState, useEffect } from 'react';
import { X, Send, AlertTriangle, ShieldAlert, CheckCircle2, RotateCcw, Clock, Trash2, Download } from 'lucide-react';
import { Recording, Sentence, User } from '../../types';
import { formatDuration, formatFileSize, formatDate } from '../../utils/formatters';
import { audioStorageService } from '../../services/audioStorageService';
import { AudioPlayer } from '../AudioPlayer';

interface RecordingDetailsModalProps {
  recording: Recording;
  sentence?: Sentence;
  user: User;
  onRequestDeletion: (recording: Recording, reason?: string) => Promise<void>;
  onRetake?: (sentence: Sentence) => void;
  onClose: () => void;
  isDeletionPending?: boolean;
}

export const RecordingDetailsModal: React.FC<RecordingDetailsModalProps> = ({
  recording,
  sentence,
  user: _user,
  onRequestDeletion,
  onRetake,
  onClose,
  isDeletionPending = false,
}) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(isDeletionPending);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    audioStorageService.getAudioUrl(recording.localFilePath).then((url) => {
      if (active && url) {
        createdUrl = url;
        setAudioUrl(url);
      }
    });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [recording.localFilePath]);

  const handleSubmitDeletionRequest = async () => {
    setSubmittingRequest(true);
    setErrorMessage(null);
    try {
      await onRequestDeletion(recording, deletionReason.trim() || undefined);
      setRequestSubmitted(true);
      setShowRequestForm(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to submit deletion request.');
      }
    } finally {
      setSubmittingRequest(false);
    }
  };

  const isRetakeRequested = recording.reviewStatus === 'retake_required';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl bg-white border border-teal-100 p-5 md:p-6 shadow-2xl flex flex-col space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/80">
              Prompt #{sentence?.sentenceNumber || recording.sentenceId}
            </span>
            <span className="text-xs font-semibold text-slate-700">
              {sentence?.difficultyLevel || `Level ${recording.level}`}
            </span>
            {sentence?.category && (
              <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium border border-teal-200/60">
                {sentence.category}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Retake Requested Banner (if Admin requested retake) */}
        {isRetakeRequested && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <RotateCcw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900">Administrator Requested a Retake</p>
                {recording.reviewDecision?.reason && (
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    <strong>Reviewer Feedback:</strong> "{recording.reviewDecision.reason}"
                  </p>
                )}
                <p className="text-[11px] text-amber-700">
                  You can record a new take for this prompt. The new attempt will be submitted for admin review.
                </p>
              </div>
            </div>

            {onRetake && sentence && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRetake(sentence);
                }}
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake This Prompt Now</span>
              </button>
            )}
          </div>
        )}

        {/* Sentence Text */}
        <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-100/90 shadow-xs">
          <p className="text-[11px] text-teal-700 uppercase tracking-wider mb-1 font-bold">
            Sentence Prompt
          </p>
          <p className="text-sm font-bold text-slate-900 leading-relaxed">
            "{sentence ? sentence.text : 'Unknown sentence'}"
          </p>
          {sentence?.instructionNotes && (
            <p className="text-xs text-slate-600 font-medium mt-1">
              ({sentence.instructionNotes})
            </p>
          )}
        </div>

        {/* Audio Player */}
        <div>
          <AudioPlayer audioUrl={audioUrl} showDetails={false} />
        </div>

        {/* Audio Specifications Table */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-200/60">
            <span>Audio Quality</span>
            <span className="font-semibold text-slate-800">16kHz · 16-bit Mono PCM WAV</span>
          </div>

          <div className="flex items-center justify-between text-slate-500">
            <span>Duration & Size</span>
            <span className="font-semibold text-slate-800 tabular-nums">
              {formatDuration(recording.duration)} ({formatFileSize(recording.fileSize)})
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-500">
            <span>Recorded On</span>
            <span className="text-slate-800 font-medium">{formatDate(recording.timestamp)}</span>
          </div>

          <div className="flex items-center justify-between text-slate-500">
            <span>Attempt Count</span>
            <span className="text-slate-800 font-medium font-mono">Trial #{recording.attemptNumber || 1}</span>
          </div>

          <div className="flex items-center justify-between text-slate-500">
            <span>Review Status</span>
            <span className="capitalize font-semibold text-slate-800">
              {(recording.reviewStatus || 'pending').replace(/_/g, ' ')}
            </span>
          </div>

          {/* Storage Architecture & Path Specification */}
          <div className="pt-2 border-t border-slate-200/60 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-600 font-medium">
              <span>Storage Architecture:</span>
              <span className="font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                System Disk Storage (Path Pointer in DB)
              </span>
            </div>

            <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-1 font-mono text-[10px]">
              <div className="text-slate-400">System File Path:</div>
              <div className="text-slate-800 break-all select-all font-bold">
                {recording.localFilePath}
              </div>
              <div className="text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span>Google Cloud Storage Ready:</span>
                <span className="text-teal-700 font-semibold">gs://revoice-speech-corpus-prod/...</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => audioStorageService.downloadAudioFileToLocalDisk(recording.localFilePath, `${recording.recordingId || recording.id}.wav`)}
              className="w-full mt-1.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Download className="w-4 h-4 text-teal-600" />
              <span>Save Audio File to Local Machine (WAV)</span>
            </button>
          </div>

          {/* Research Corpus Metadata */}
          <div className="pt-2 border-t border-slate-200/60 space-y-1.5 text-[11px]">
            <div className="text-slate-500 font-medium">Corpus Identifiers:</div>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="bg-white p-1.5 rounded border border-slate-200 truncate">
                <span className="text-slate-400">rec:</span> {recording.recordingId || recording.id}
              </div>
              <div className="bg-white p-1.5 rounded border border-slate-200 truncate">
                <span className="text-slate-400">prompt:</span> {recording.promptId || recording.sentenceId}
              </div>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Deletion Request Status / Form */}
        {requestSubmitted ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>Deletion Request Submitted to Admin</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Your deletion request for this audio take has been sent to the ReVoice Administrator for review and processing. The admin will verify and delete the audio file.
            </p>
          </div>
        ) : showRequestForm ? (
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-rose-950">Request Audio Deletion from Admin</p>
                <p className="text-[11px] text-rose-800/90 leading-relaxed">
                  Submitted audio takes cannot be directly deleted by participants to maintain research provenance. This request will be sent directly to the ReVoice Administrator to delete the audio file.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Reason for deletion request (optional):
              </label>
              <textarea
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                rows={2}
                placeholder="e.g. Accidental noise, personal request, or voice fatigue..."
                className="w-full text-xs p-2.5 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-rose-400 placeholder:text-slate-400"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowRequestForm(false)}
                disabled={submittingRequest}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitDeletionRequest}
                disabled={submittingRequest}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submittingRequest ? 'Submitting Request...' : 'Submit Request to Admin'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowRequestForm(true)}
              className="min-h-[44px] px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              title="Request deletion of this submitted audio take from administrator"
            >
              <Trash2 className="w-4 h-4" />
              <span>Request Deletion from Admin</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition active:scale-95 border border-slate-200"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
