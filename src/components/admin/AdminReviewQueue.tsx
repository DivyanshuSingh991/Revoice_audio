import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Play,
  Pause,
  Filter,
  Search,
  CheckSquare,
  Square,
  ShieldCheck,
  Send,
  HelpCircle,
  Clock,
  AudioLines,
} from 'lucide-react';
import { Recording, Sentence, SentenceLevel, ReviewStatus, Cohort, User } from '../../types';
import { formatDuration, formatDate, formatFileSize } from '../../utils/formatters';
import { audioStorageService } from '../../services/audioStorageService';
import { recordingRepository } from '../../services/recordingRepository';

interface AdminReviewQueueProps {
  adminUser: User;
  recordings: Recording[];
  sentencesMap: Map<string, Sentence>;
  onReviewSubmitted: (updatedRecording: Recording) => void;
}

export const AdminReviewQueue: React.FC<AdminReviewQueueProps> = ({
  adminUser,
  recordings,
  sentencesMap,
  onReviewSubmitted,
}) => {
  const [reviewFilter, setReviewFilter] = useState<ReviewStatus | 'all'>('pending');
  const [cohortFilter, setCohortFilter] = useState<Cohort | 'all'>('all');
  const [levelFilter, setLevelFilter] = useState<SentenceLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected recording for active review
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);

  // Audio player state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioElementRef = React.useRef<HTMLAudioElement | null>(null);

  // Quality Checklist state
  const [checklist, setChecklist] = useState({
    idConsistency: true,
    fileIntegrity: true,
    completeness: true,
    clarity: true,
    lowNoise: true,
    metadataAccurate: true,
  });

  // Rejection / Retake reason modal/form state
  const [decisionAction, setDecisionAction] = useState<'reject' | 'retake' | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);

  // Filtered queue
  const filteredQueue = useMemo(() => {
    return recordings.filter((rec) => {
      if (reviewFilter !== 'all' && (rec.reviewStatus || 'pending') !== reviewFilter) return false;
      if (cohortFilter !== 'all' && (rec.cohort || 'healthy') !== cohortFilter) return false;
      if (levelFilter !== 'all' && rec.level !== levelFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sentence = sentencesMap.get(rec.sentenceId);
        const matchPrompt = (rec.promptId || rec.sentenceId).toLowerCase().includes(q);
        const matchRecId = (rec.recordingId || rec.id).toLowerCase().includes(q);
        const matchSpeaker = (rec.speakerId || rec.participantId).toLowerCase().includes(q);
        const matchText = sentence?.text.toLowerCase().includes(q);
        if (!matchPrompt && !matchRecId && !matchSpeaker && !matchText) return false;
      }

      return true;
    });
  }, [recordings, reviewFilter, cohortFilter, levelFilter, searchQuery, sentencesMap]);

  // Set default selected recording if none selected
  useEffect(() => {
    if (filteredQueue.length > 0 && (!selectedRecId || !filteredQueue.some((r) => r.id === selectedRecId))) {
      setSelectedRecId(filteredQueue[0].id);
    }
  }, [filteredQueue, selectedRecId]);

  const activeRecording = useMemo(() => {
    return recordings.find((r) => r.id === selectedRecId) || null;
  }, [recordings, selectedRecId]);

  const activeSentence = useMemo(() => {
    if (!activeRecording) return null;
    return sentencesMap.get(activeRecording.sentenceId) || null;
  }, [activeRecording, sentencesMap]);

  // Load audio URL when active recording changes
  useEffect(() => {
    let active = true;
    if (activeRecording) {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setIsPlaying(false);

      audioStorageService.getAudioUrl(activeRecording.localFilePath).then((url) => {
        if (active && url) {
          setAudioUrl(url);
          if (audioElementRef.current) {
            audioElementRef.current.src = url;
          }
        }
      });
    }

    return () => {
      active = false;
    };
  }, [activeRecording?.id]);

  const togglePlayAudio = () => {
    if (!audioUrl || !audioElementRef.current) return;
    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleApprove = async () => {
    if (!activeRecording) return;
    if (activeRecording.reviewStatus === 'rejected') {
      setReviewFeedback('Action blocked: Rejected recordings cannot be approved.');
      return;
    }
    setSubmittingReview(true);
    setReviewFeedback(null);

    try {
      const updated = await recordingRepository.submitReviewDecision(
        activeRecording.id,
        'approved',
        adminUser.id,
        adminUser.email,
        checklist
      );
      setReviewFeedback(`Recording ${activeRecording.id} approved for research quality.`);
      onReviewSubmitted(updated);
    } catch (err) {
      console.error(err);
      setReviewFeedback('Failed to submit review decision.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleConfirmDecisionWithReason = async () => {
    if (!activeRecording || !decisionAction) return;
    if (activeRecording.reviewStatus === 'rejected') {
      setReviewFeedback('Action blocked: This recording has already been rejected.');
      setDecisionAction(null);
      return;
    }
    if (!decisionReason.trim()) {
      alert('Please provide a mandatory reason for this decision.');
      return;
    }

    setSubmittingReview(true);
    setReviewFeedback(null);

    const targetStatus: ReviewStatus = decisionAction === 'reject' ? 'rejected' : 'retake_required';

    try {
      const updated = await recordingRepository.submitReviewDecision(
        activeRecording.id,
        targetStatus,
        adminUser.id,
        adminUser.email,
        checklist,
        decisionReason.trim()
      );
      setReviewFeedback(`Recording ${activeRecording.id} marked as ${targetStatus.replace(/_/g, ' ')}.`);
      setDecisionAction(null);
      setDecisionReason('');
      onReviewSubmitted(updated);
    } catch (err) {
      console.error(err);
      setReviewFeedback('Failed to submit review decision.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-24 px-4 pt-4">
      {/* Audio Element Hidden */}
      <audio
        ref={audioElementRef}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clinical Review & Quality Assurance Queue</h1>
          <p className="text-xs text-slate-500">
            Audit speech fidelity, acoustic integrity, and assign review determinations with verified checklists.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            {filteredQueue.length} takes in active queue
          </span>
        </div>
      </div>

      {/* Queue Filter Bar */}
      <div className="space-y-3 rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Prompt ID, Recording ID, or Hindi text..."
            className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
          {/* Status filter */}
          <span className="text-[11px] text-slate-500 font-semibold">Status:</span>
          {(['all', 'pending', 'approved', 'rejected', 'retake_required'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setReviewFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition ${
                reviewFilter === st
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}

          <span className="text-slate-300 mx-1">|</span>

          {/* Cohort filter */}
          <span className="text-[11px] text-slate-500 font-semibold">Cohort:</span>
          {(['all', 'healthy', 'speech_impaired'] as const).map((coh) => (
            <button
              key={coh}
              type="button"
              onClick={() => setCohortFilter(coh)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition ${
                cohortFilter === coh
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {coh.replace(/_/g, ' ')}
            </button>
          ))}

          <span className="text-slate-300 mx-1">|</span>

          {/* Level filter */}
          <span className="text-[11px] text-slate-500 font-semibold">Level:</span>
          {(['all', 1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition ${
                levelFilter === lvl
                  ? 'bg-slate-900 text-white font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {lvl === 'all' ? 'All' : `L${lvl}`}
            </button>
          ))}
        </div>
      </div>

      {/* Review Feedback Toast */}
      {reviewFeedback && (
        <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{reviewFeedback}</span>
        </div>
      )}

      {/* MAIN TWO-COLUMN REVIEW WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Queue List */}
        <div className="lg:col-span-1 space-y-2 max-h-[620px] overflow-y-auto pr-1">
          {filteredQueue.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              No recordings in this review filter.
            </div>
          ) : (
            filteredQueue.map((rec) => {
              const sentence = sentencesMap.get(rec.sentenceId);
              const isSelected = rec.id === selectedRecId;

              return (
                <div
                  key={rec.id}
                  onClick={() => setSelectedRecId(rec.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition text-xs space-y-1 ${
                    isSelected
                      ? 'bg-teal-50/80 border-teal-400 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-800">
                      {rec.promptId || rec.sentenceId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        rec.reviewStatus === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : rec.reviewStatus === 'rejected'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : rec.reviewStatus === 'retake_required'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {rec.reviewStatus || 'pending'}
                    </span>
                  </div>

                  <p className="font-medium text-slate-900 truncate">
                    {sentence ? sentence.text : 'Unknown sentence'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{rec.speakerId}</span>
                    <span>{formatDuration(rec.duration)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Detailed Review Card */}
        <div className="lg:col-span-2 space-y-4">
          {activeRecording ? (
            <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-xs space-y-5">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                      {activeRecording.recordingId || activeRecording.id}
                    </span>
                    <span className="font-mono text-sm font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      {activeRecording.promptId || activeRecording.sentenceId}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                      Level {activeRecording.level}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                      Cohort: {activeRecording.cohort || 'healthy'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono">
                    {formatDuration(activeRecording.duration)} · {formatFileSize(activeRecording.fileSize)}
                  </span>
                </div>
              </div>

              {/* Hindi Text Prompt */}
              <div className="p-5 rounded-2xl bg-teal-50/60 border border-teal-100 text-center space-y-1">
                <p className="text-[11px] text-teal-800 font-bold uppercase tracking-wider">
                  Target Speech Prompt
                </p>
                <p className="text-xl font-bold text-slate-900 leading-relaxed">
                  "{activeSentence ? activeSentence.text : 'Unknown prompt'}"
                </p>
                {activeSentence?.instructionNotes && (
                  <p className="text-xs text-slate-600 font-medium">
                    ({activeSentence.instructionNotes})
                  </p>
                )}
              </div>

              {/* Inline Audio Player Bar */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlayAudio}
                    className="w-11 h-11 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center justify-center transition active:scale-95 shadow-md"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>

                  <div>
                    <div className="text-xs font-bold">16kHz 16-bit Mono Linear PCM WAV</div>
                    <div className="text-[11px] text-slate-400">
                      Duration: {formatDuration(activeRecording.duration)} · Sample Rate: {activeRecording.sampleRate} Hz
                    </div>
                  </div>
                </div>

                <div className="text-right text-xs text-teal-300 font-mono">
                  {isPlaying ? 'Playing Audio Take...' : 'Ready to Audition'}
                </div>
              </div>

              {/* QUALITY CHECKLIST (MANDATORY CLINICAL REVIEW) */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                  <span>Clinical Speech Quality Verification Checklist:</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'idConsistency', label: 'Participant & Prompt ID Consistency Verified' },
                    { key: 'fileIntegrity', label: 'WAV File Integrity & 16kHz Header Valid' },
                    { key: 'completeness', label: 'Prompt Read Completely Without Clipping' },
                    { key: 'clarity', label: 'Speech Articulation & Phonetic Clarity' },
                    { key: 'lowNoise', label: 'Background Noise within Tolerable Bounds' },
                    { key: 'metadataAccurate', label: 'Acoustic Metadata Accurately Indexed' },
                  ].map((item) => {
                    const isChecked = checklist[item.key as keyof typeof checklist];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          setChecklist((prev) => ({
                            ...prev,
                            [item.key]: !prev[item.key as keyof typeof checklist],
                          }))
                        }
                        className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                          isChecked
                            ? 'bg-teal-50/60 border-teal-300 text-teal-950 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0 text-teal-600">
                          {isChecked ? <CheckSquare className="w-4 h-4 fill-teal-600 text-white" /> : <Square className="w-4 h-4" />}
                        </div>
                        <span className="text-[11px] leading-snug">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* REVIEW ACTIONS */}
              {activeRecording.reviewStatus === 'rejected' ? (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-rose-950">Recording Take Rejected</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          Disqualified Take
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-800 leading-relaxed">
                        This recording has been formally rejected. In accordance with clinical corpus standards, Request Retake and Approve options are removed for rejected recordings.
                      </p>
                      {activeRecording.reviewDecision?.reason && (
                        <div className="mt-1.5 p-2.5 rounded-xl bg-white border border-rose-200 text-[11px] text-rose-950">
                          <strong>Logged Rejection Reason:</strong> "{activeRecording.reviewDecision.reason}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setDecisionAction('retake');
                        setDecisionReason('');
                      }}
                      disabled={submittingReview}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Request Retake</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDecisionAction('reject');
                        setDecisionReason('');
                      }}
                      disabled={submittingReview}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Reject Take</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={submittingReview}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Take</span>
                  </button>
                </div>
              )}

              {/* Clinical Quality Disclaimer */}
              <p className="text-[10px] text-slate-400 italic pt-1 leading-relaxed border-t border-slate-100">
                Notice: Approval for research quality does not automatically authorize every possible data-use purpose or imply a clinical diagnosis or medical assessment.
              </p>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
              Select a recording from the review queue on the left to audition and audit audio quality.
            </div>
          )}
        </div>
      </div>

      {/* REASON MODAL FOR REJECT OR RETAKE */}
      {decisionAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 capitalize">
              {decisionAction === 'reject' ? 'Reject Recording Take' : 'Request Participant Retake'}
            </h3>

            <p className="text-xs text-slate-600">
              Please enter the clinical or acoustic rationale for this decision. This note will be recorded in the audit history and made available to the participant.
            </p>

            <textarea
              rows={4}
              required
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder={
                decisionAction === 'reject'
                  ? 'e.g. Severe clipping, incorrect sentence read, background noise exceeded limit...'
                  : 'e.g. Mild hesitation on phoneme cluster, low microphone volume, please repeat prompt...'
              }
              className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
            />

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDecisionAction(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDecisionWithReason}
                disabled={submittingReview || !decisionReason.trim()}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition disabled:opacity-40 ${
                  decisionAction === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {submittingReview ? 'Submitting...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
