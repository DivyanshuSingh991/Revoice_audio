import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Trash2,
  Info,
  Search,
  Filter,
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  RotateCcw,
  Shield,
  Download,
  Volume2,
} from 'lucide-react';
import { Recording, Sentence, SentenceLevel, User, ReviewStatus } from '../../types';
import { formatDuration, formatDate, formatFileSize, buildRecordingId } from '../../utils/formatters';
import { audioStorageService } from '../../services/audioStorageService';

interface MyRecordingsScreenProps {
  user: User;
  recordings: Recording[];
  sentencesMap: Map<string, Sentence>;
  onOpenDetails: (recording: Recording) => void;
  onRequestDelete: (recording: Recording) => void;
  onRetakeRecording?: (sentence: Sentence) => void;
  onBackToDashboard: () => void;
  onExportCorpus: () => Promise<void>;
  exporting: boolean;
  pendingDeletionRecIds?: Set<string>;
}

export const MyRecordingsScreen: React.FC<MyRecordingsScreenProps> = ({
  user,
  recordings,
  sentencesMap,
  onOpenDetails,
  onRequestDelete,
  onRetakeRecording,
  onBackToDashboard,
  onExportCorpus,
  exporting,
  pendingDeletionRecIds,
}) => {
  const [levelFilter, setLevelFilter] = useState<SentenceLevel | 'all'>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Audio Playback Engine State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [audioUrlMap, setAudioUrlMap] = useState<Map<string, string>>(new Map());

  // Filter recordings
  const filteredRecordings = useMemo(() => {
    return recordings.filter((rec) => {
      if (levelFilter !== 'all' && rec.level !== levelFilter) return false;
      if (reviewFilter !== 'all' && (rec.reviewStatus || 'pending') !== reviewFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sentence = sentencesMap.get(rec.sentenceId);
        const promptId = (rec.promptId || rec.sentenceId).toLowerCase();
        const recordingId = (rec.recordingId || rec.id).toLowerCase();
        const matchText = sentence?.text.toLowerCase().includes(q);
        const matchNotes = sentence?.instructionNotes?.toLowerCase().includes(q);
        const matchCategory = sentence?.category?.toLowerCase().includes(q);
        const matchId = promptId.includes(q) || recordingId.includes(q);
        if (!matchText && !matchNotes && !matchCategory && !matchId) return false;
      }

      return true;
    });
  }, [recordings, levelFilter, reviewFilter, searchQuery, sentencesMap]);

  // Clean up object URLs on unmount & stop audio
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioUrlMap.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [audioUrlMap]);

  const handleTogglePlayInline = async (rec: Recording) => {
    setPlaybackError(null);

    // If currently active and loaded in audioRef
    if (activePlayingId === rec.id && audioRef.current && audioRef.current.src) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          return;
        } catch (err) {
          console.error('Play resume error:', err);
        }
      }
    }

    // Stop currently playing
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    setActivePlayingId(rec.id);
    setAudioLoadingId(rec.id);

    try {
      let url = audioUrlMap.get(rec.id);
      if (!url) {
        const generated = await audioStorageService.getAudioUrl(rec.localFilePath);
        if (generated) {
          url = generated;
          setAudioUrlMap((prev) => new Map(prev).set(rec.id, generated));
        } else {
          // Direct Blob fallback
          const blob = await audioStorageService.getAudioBlob(rec.localFilePath);
          if (blob) {
            url = URL.createObjectURL(blob);
            setAudioUrlMap((prev) => new Map(prev).set(rec.id, url!));
          }
        }
      }

      if (!url) {
        throw new Error('Audio recording file could not be found in local storage.');
      }

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err: unknown) {
      console.error('Audio playback failed:', err);
      const msg = err instanceof Error ? err.message : 'Audio playback error.';
      setPlaybackError(msg);
      setIsPlaying(false);
    } finally {
      setAudioLoadingId(null);
    }
  };

  const reviewStatusPill = (status?: ReviewStatus) => {
    const s = status || 'pending';
    switch (s) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Approved</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Rejected</span>
          </span>
        );
      case 'retake_required':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            <span>Awaiting Retake</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Pending Review</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-24 px-4 pt-3">
      {/* Hidden Persistent Audio Player Engine */}
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={(e) => {
          console.error('Audio playback error:', e);
          setIsPlaying(false);
          setPlaybackError('Could not play audio take. File might be corrupted.');
        }}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-white hover:bg-teal-50 text-slate-700 flex items-center justify-center transition active:scale-95 border border-slate-200/80 shadow-xs"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>

        <div className="text-center flex-1">
          <h1 className="text-base font-bold text-slate-900">My Audio Takes & Reviews</h1>
          <p className="text-xs text-teal-700 font-medium">
            {recordings.length} total submitted voice take{recordings.length === 1 ? '' : 's'}
          </p>
        </div>

        <button
          type="button"
          onClick={onExportCorpus}
          disabled={exporting || recordings.length === 0}
          className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40 shadow-xs"
          title="Export my corpus package"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{exporting ? 'Packaging...' : 'Export'}</span>
        </button>
      </div>

      {/* Authorized Data-Use Explanation Card */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-1.5 text-xs text-slate-600">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Shield className="w-4 h-4 text-teal-600" />
          <span>Authorized Data-Use Status (Consent Verified):</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          Shows how each take is authorized against your signed informed consent. Statuses are verified against backend records:
          <span className="font-semibold text-slate-800 ml-1">Approved by Consent</span>,
          <span className="font-semibold text-slate-800 ml-1">Actually Used</span> (only upon verified research export),
          or <span className="font-semibold text-slate-800 ml-1">Not Used / Unknown</span>.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by prompt text, Prompt ID (e.g. L1_S01), or Recording ID..."
            className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Level Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
          <span className="text-[11px] text-slate-500 mr-1 font-semibold">Level:</span>
          {(['all', 1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition active:scale-95 font-semibold text-xs ${
                levelFilter === lvl
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {lvl === 'all' ? 'All' : `Level ${lvl}`}
            </button>
          ))}

          <span className="text-slate-300 mx-1">|</span>

          {/* Review Status Filters */}
          <span className="text-[11px] text-slate-500 mr-1 font-semibold">Review:</span>
          {(['all', 'pending', 'approved', 'rejected', 'retake_required'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setReviewFilter(st)}
              className={`px-2.5 py-1 rounded-md text-[11px] capitalize transition font-medium whitespace-nowrap ${
                reviewFilter === st
                  ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Recordings Cards List */}
      <div className="space-y-3">
        {filteredRecordings.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-white border border-slate-200/80 text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 mx-auto flex items-center justify-center text-teal-600">
              <AudioLines className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No recordings match criteria</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Select your assigned prompts on the dashboard to record and submit your speech takes.
              </p>
            </div>
          </div>
        ) : (
          filteredRecordings.map((rec) => {
            const sentence = sentencesMap.get(rec.sentenceId);
            const isPlaying = activePlayingId === rec.id;
            const promptId = rec.promptId || sentence?.promptId || rec.sentenceId;
            const recordingId = rec.recordingId || rec.id;

            return (
              <div
                key={rec.id}
                className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-300 transition space-y-3 shadow-xs"
              >
                {/* Top Row: Recording Metadata & Review Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      {recordingId}
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {promptId}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                      Level {rec.level}
                    </span>
                    <span className="text-[11px] text-teal-800 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
                      Attempt #{rec.attemptNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {formatDuration(rec.duration)} · {formatFileSize(rec.fileSize)}
                    </span>
                  </div>

                  <div>
                    {reviewStatusPill(rec.reviewStatus)}
                  </div>
                </div>

                {/* Sentence Text */}
                <div className="space-y-1">
                  <p className="text-base font-bold text-slate-900 leading-snug">
                    "{sentence ? sentence.text : 'Recorded sentence'}"
                  </p>
                  {sentence?.instructionNotes && (
                    <p className="text-xs text-slate-500 font-medium">
                      ({sentence.instructionNotes})
                    </p>
                  )}
                </div>

                {/* Rejection / Retake Reason (if provided by reviewer) */}
                {rec.reviewDecision?.reason && (rec.reviewStatus === 'rejected' || rec.reviewStatus === 'retake_required') && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold flex items-center gap-1.5 text-amber-900">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Administrator Feedback:</span>
                      </p>
                      {rec.reviewStatus === 'retake_required' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                          Retake Action Enabled
                        </span>
                      )}
                    </div>
                    <p className="text-amber-800 text-[11px] leading-relaxed pl-5">
                      "{rec.reviewDecision.reason}"
                    </p>

                    {/* Enabled Retake Button for this Audio Take */}
                    {rec.reviewStatus === 'retake_required' && onRetakeRecording && sentence && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => onRetakeRecording(sentence)}
                          className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retake Audio Take (Requested by Admin)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Authorized Data-Use Status Badges */}
                <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                  <span className="font-semibold text-slate-500">Authorized Data-Use Purposes:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                      <p className="text-slate-500 text-[10px]">Acoustic Speech Models</p>
                      <p className="font-bold text-emerald-700 mt-0.5">
                        {rec.dataUseStatus?.speechRecognitionModel === 'approved' ? 'Approved by Consent' : 'Not Used'}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                      <p className="text-slate-500 text-[10px]">Clinical Biomarkers</p>
                      <p className="font-bold text-emerald-700 mt-0.5">
                        {rec.dataUseStatus?.clinicalAcousticResearch === 'approved' ? 'Approved by Consent' : 'Not Used'}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                      <p className="text-slate-500 text-[10px]">Open Research Dataset</p>
                      <p className="font-bold text-slate-600 mt-0.5">
                        Not Used (Restricted)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Active Audio Playback Bar when this Take is Selected */}
                {activePlayingId === rec.id && (
                  <div className="p-3.5 rounded-2xl bg-teal-50/90 border border-teal-200/90 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-teal-900">
                        <Volume2 className={`w-4 h-4 text-teal-600 ${isPlaying ? 'animate-pulse' : ''}`} />
                        <span>{isPlaying ? 'Playing Audio Take...' : 'Take Paused'}</span>
                      </div>
                      <div className="font-mono text-xs text-teal-800 font-bold tabular-nums">
                        {formatDuration(currentTime)} / {formatDuration(duration || rec.duration)}
                      </div>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={duration || rec.duration || 1}
                      step={0.05}
                      value={currentTime}
                      onChange={(e) => {
                        const newTime = parseFloat(e.target.value);
                        if (audioRef.current) {
                          audioRef.current.currentTime = newTime;
                          setCurrentTime(newTime);
                        }
                      }}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-none"
                    />

                    {playbackError && (
                      <p className="text-[11px] text-rose-700 font-medium">
                        {playbackError}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions: Audio Playback, Details, Request Deletion */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>Uploaded {formatDate(rec.timestamp)}</span>
                    {pendingDeletionRecIds?.has(recordingId) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Deletion Request Pending with Admin</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Retake shortcut on bottom bar if retake requested */}
                    {rec.reviewStatus === 'retake_required' && onRetakeRecording && sentence && (
                      <button
                        type="button"
                        onClick={() => onRetakeRecording(sentence)}
                        className="min-h-[40px] px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                        title="Re-record this prompt as requested by reviewer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retake</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleTogglePlayInline(rec)}
                      disabled={audioLoadingId === rec.id}
                      className={`min-h-[40px] px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs ${
                        activePlayingId === rec.id && isPlaying
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                          : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
                      }`}
                      title={activePlayingId === rec.id && isPlaying ? 'Pause audio' : 'Play audio take'}
                    >
                      {audioLoadingId === rec.id ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading...</span>
                        </>
                      ) : activePlayingId === rec.id && isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{activePlayingId === rec.id && currentTime > 0 ? 'Resume' : 'Play Take'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => audioStorageService.downloadAudioFileToLocalDisk(rec.localFilePath, `${recordingId}.wav`)}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      title="Save WAV to computer disk"
                    >
                      <Download className="w-4 h-4 text-teal-600" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenDetails(rec)}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      title="Inspect audio specs, system path & request deletion"
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRequestDelete(rec)}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition"
                      title="Request deletion of this submitted take from administrator"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
