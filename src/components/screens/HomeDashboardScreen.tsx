import React, { useState, useMemo } from 'react';
import {
  Mic,
  AudioLines,
  ShieldAlert,
  CheckCircle2,
  Activity,
  Radio,
  Clock,
  FileAudio,
  Sliders,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  Users,
  Search,
  Filter,
  Layers,
} from 'lucide-react';
import { User, SentenceLevel, Sentence, ParticipantProgress, Recording } from '../../types';
import { UserStats } from '../../services/recordingRepository';
import { MicrophoneTestWidget } from './MicrophoneTestWidget';

interface HomeDashboardScreenProps {
  user: User;
  hasConsent: boolean;
  stats: UserStats;
  allSentences: Sentence[];
  progress: ParticipantProgress | null;
  assignedSentences: Record<SentenceLevel, Sentence | null>;
  onRecordSentence: (sentence: Sentence) => void;
  onOpenMyRecordings: () => void;
  onOpenConsent: () => void;
  onUpdateTargetPerLevel?: (target: number) => Promise<void>;
  recordings?: Recording[];
}

export const HomeDashboardScreen: React.FC<HomeDashboardScreenProps> = ({
  user,
  hasConsent,
  stats,
  allSentences,
  progress,
  assignedSentences,
  onRecordSentence,
  onOpenMyRecordings,
  onOpenConsent,
  onUpdateTargetPerLevel,
  recordings = [],
}) => {
  const [showConfigTarget, setShowConfigTarget] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [levelFilter, setLevelFilter] = useState<'all' | SentenceLevel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'recorded' | 'unrecorded'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const levelInfo: Record<SentenceLevel, { title: string; subtitle: string; tag: string; badgeColor: string }> = {
    1: {
      title: 'Level 1: Phoneme Repetition',
      subtitle: 'Clear articulation of balanced phoneme clusters (L1 prompts).',
      tag: 'Easy',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    2: {
      title: 'Level 2: Sen Max Alphabet',
      subtitle: 'Broad phonetic alphabet span & natural speech cadence (L2 prompts).',
      tag: 'Medium',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    3: {
      title: 'Level 3: Complex Sentence',
      subtitle: 'Syntactic structures and multisyllabic clinical vocabulary (L3 prompts).',
      tag: 'Hard',
      badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    },
  };

  const targetPerLevel = progress?.targetPerLevel || 1;
  const totalTargetSentences = targetPerLevel * 3;
  const completedTargetCount = Math.min(totalTargetSentences, stats.totalDistinctRecorded);
  const targetPercentage = Math.min(100, Math.round((completedTargetCount / totalTargetSentences) * 100));

  // Find recordings where administrator requested a retake
  const retakeRequiredRecordings = recordings.filter(
    (r) => r.reviewStatus === 'retake_required'
  );

  // Map recordings by promptId or sentenceId
  const recordingsByPrompt = useMemo(() => {
    const map = new Map<string, Recording[]>();
    for (const rec of recordings) {
      const keys = [rec.promptId, rec.sentenceId].filter(Boolean) as string[];
      for (const k of keys) {
        const list = map.get(k) || [];
        list.push(rec);
        map.set(k, list);
      }
    }
    return map;
  }, [recordings]);

  // Compute displayed sentences (All 30 sentences displayed at once by default)
  const displayedSentences = useMemo(() => {
    // Sort consistently by level, then sentenceNumber
    const sorted = [...allSentences].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.sentenceNumber - b.sentenceNumber;
    });

    return sorted.filter((s) => {
      // 1. Level filter
      if (levelFilter !== 'all' && s.level !== levelFilter) return false;

      // 2. Status filter
      const takes = recordingsByPrompt.get(s.promptId || s.id) || recordingsByPrompt.get(s.id) || [];
      const isRecorded = takes.length > 0;
      if (statusFilter === 'recorded' && !isRecorded) return false;
      if (statusFilter === 'unrecorded' && isRecorded) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pid = (s.promptId || s.id || '').toLowerCase();
        const text = s.text.toLowerCase();
        const notes = (s.instructionNotes || '').toLowerCase();
        const cat = (s.category || '').toLowerCase();
        if (!pid.includes(q) && !text.includes(q) && !notes.includes(q) && !cat.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allSentences, levelFilter, statusFilter, searchQuery, recordingsByPrompt]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-24 px-4 pt-3">
      {/* Retake Requested by Administrator Alert Banner */}
      {retakeRequiredRecordings.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 space-y-3 shadow-xs animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 font-bold text-amber-950 text-sm">
              <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Action Required: Administrator Requested Audio Retake</span>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
              {retakeRequiredRecordings.length} Take{retakeRequiredRecordings.length === 1 ? '' : 's'} to Re-record
            </span>
          </div>

          <p className="text-xs text-amber-900/90 leading-relaxed">
            The clinical administrator reviewed your submitted recording and requested a new take. Retake options are now enabled for the affected prompts:
          </p>

          <div className="space-y-2">
            {retakeRequiredRecordings.map((rec) => {
              const sentence = allSentences.find((s) => s.id === rec.sentenceId) || assignedSentences[rec.level];
              return (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl bg-white border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {rec.promptId || rec.sentenceId}
                      </span>
                      <span className="text-slate-500 font-sans">Level {rec.level}</span>
                    </div>
                    <p className="font-bold text-slate-900 truncate">
                      "{sentence ? sentence.text : 'Assigned prompt'}"
                    </p>
                    {rec.reviewDecision?.reason && (
                      <p className="text-amber-800 text-[11px] leading-relaxed">
                        <strong>Reviewer reason:</strong> "{rec.reviewDecision.reason}"
                      </p>
                    )}
                  </div>

                  {sentence && (
                    <button
                      type="button"
                      onClick={() => onRecordSentence(sentence)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 transition active:scale-95 shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retake Take Now</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Consent Warning Banner */}
      {!hasConsent && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">Informed Consent Required</p>
              <p className="text-xs text-amber-800/80 mt-0.5">
                Recording is paused until you review and agree to the voice collection consent terms.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenConsent}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap transition active:scale-95 shadow-xs"
          >
            Review Terms
          </button>
        </div>
      )}

      {/* Hero Welcome Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#0b332d] via-[#0f443b] to-[#041c18] text-white p-5 md:p-6 shadow-xl relative overflow-hidden border border-teal-800/40">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-md">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-[11px] font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ReVoice Recording Studio</span>
              </span>

              {/* Cohort Tag */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold">
                <Users className="w-3 h-3" />
                <span>{user.cohort === 'speech_impaired' ? 'Speech-Impaired Cohort' : 'Healthy Cohort'}</span>
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
              Welcome back, {user.name}
            </h1>

            <p className="text-xs text-teal-100/80 leading-relaxed">
              Assigned prompts are individualized to your cohort and sequence automatically after each verified submission.
            </p>

            <div className="flex items-center gap-2 pt-1 flex-wrap text-xs text-teal-200">
              <span className="font-mono bg-teal-950/80 px-2 py-0.5 rounded border border-teal-700/60 font-bold">
                {user.participantId}
              </span>
              <span>•</span>
              <span className="text-teal-300/80 font-mono">
                {user.mobileNumber ? `+91 ${user.mobileNumber}` : user.email}
              </span>
            </div>
          </div>

          {/* Configurable Target Progress Pod */}
          <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-teal-800/50 sm:min-w-[200px] shadow-inner">
            <div className="flex items-center justify-between text-[11px] text-teal-300 font-semibold uppercase tracking-wider">
              <span>Target Sentences</span>
              {onUpdateTargetPerLevel && (
                <button
                  type="button"
                  onClick={() => setShowConfigTarget(!showConfigTarget)}
                  className="text-teal-300 hover:text-white transition p-0.5"
                  title="Configure target sentences per level"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">
              {completedTargetCount}
              <span className="text-xs text-teal-200/70 font-sans font-normal ml-1">
                / {totalTargetSentences} Sentences
              </span>
            </div>

            <div className="w-full bg-slate-800/80 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 to-emerald-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${targetPercentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-teal-200/80 mt-1.5 font-medium">
              <span>{targetPerLevel} per level</span>
              <span className="tabular-nums">{targetPercentage}% Completed</span>
            </div>

            {/* Target Config Slider */}
            {showConfigTarget && onUpdateTargetPerLevel && (
              <div className="mt-2.5 pt-2 border-t border-teal-800/50 space-y-1 text-xs">
                <div className="flex justify-between text-[10px] text-teal-200">
                  <span>Target per level:</span>
                  <span className="font-bold">{targetPerLevel}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={targetPerLevel}
                  onChange={(e) => onUpdateTargetPerLevel(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recording Instructions Card */}
      {showInstructions && (
        <div className="rounded-2xl bg-teal-50/70 border border-teal-200/70 p-4 relative text-xs text-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-teal-900">
              <HelpCircle className="w-4 h-4 text-teal-700" />
              <span>Recording Instructions & Workflow:</span>
            </div>
            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold"
            >
              Hide
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-0.5">
            <li><strong>Sound Check:</strong> Use the test tool below to verify clear microphone volume.</li>
            <li><strong>Assigned Prompts:</strong> Read each assigned prompt aloud in a quiet environment.</li>
            <li><strong>Independent Progression:</strong> When you submit a take, your level sequence advances (e.g. S01 &rarr; S02).</li>
            <li><strong>Retakes:</strong> Retaking repeats the same prompt without advancing. All attempts are saved separately.</li>
          </ol>
        </div>
      )}

      {/* Microphone Test Widget */}
      <MicrophoneTestWidget />

      {/* ALL 30 PROMPTS WORKSTATION */}
      <div className="space-y-4 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Speech Corpus Prompts ({allSentences.length} Total)
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                All Visible
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              All 30 clinical sentences displayed together • Individual Record controls corresponding to every prompt
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenMyRecordings}
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/70 flex items-center gap-1.5 transition active:scale-95 shadow-xs self-start sm:self-center"
          >
            <AudioLines className="w-3.5 h-3.5 text-teal-600" />
            <span>My Audio Submissions ({stats.totalAttempts})</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setLevelFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                levelFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All 30 Prompts
            </button>
            {([1, 2, 3] as SentenceLevel[]).map((lvl) => {
              const info = levelInfo[lvl];
              const count = allSentences.filter((s) => s.level === lvl).length;
              const recCount = stats.levels[lvl]?.distinctRecorded || 0;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    levelFilter === lvl
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{info.tag} (Level {lvl})</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      levelFilter === lvl ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {recCount}/{count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Status Filter Row */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompt ID (e.g. L1_S01), Hindi text, or phonetic notes..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Status Segmented Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All ({allSentences.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('recorded')}
                className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  statusFilter === 'recorded'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Recorded ({stats.totalDistinctRecorded})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unrecorded')}
                className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  statusFilter === 'unrecorded'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Unrecorded ({Math.max(0, allSentences.length - stats.totalDistinctRecorded)})
              </button>
            </div>
          </div>
        </div>

        {/* 30 Sentences List */}
        <div className="space-y-3">
          {displayedSentences.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">No matching prompts found</p>
              <p className="text-xs text-slate-400">Try adjusting your search query or level filters.</p>
              <button
                type="button"
                onClick={() => {
                  setLevelFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="mt-2 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 text-xs font-bold border border-teal-200 hover:bg-teal-100"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            displayedSentences.map((sentence) => {
              const pid = sentence.promptId || sentence.id;
              const takes = recordingsByPrompt.get(pid) || recordingsByPrompt.get(sentence.id) || [];
              const hasRecorded = takes.length > 0;
              const info = levelInfo[sentence.level];
              const isRetake = takes.some((r) => r.reviewStatus === 'retake_required');
              const retakeRec = takes.find((r) => r.reviewStatus === 'retake_required');
              const isAssigned = assignedSentences[sentence.level]?.id === sentence.id;

              return (
                <div
                  key={sentence.id}
                  className={`p-4 sm:p-5 rounded-2xl bg-white border transition shadow-xs space-y-3 ${
                    isRetake
                      ? 'border-amber-300 ring-2 ring-amber-300/30 bg-amber-50/15'
                      : hasRecorded
                      ? 'border-emerald-200/90 bg-emerald-50/5'
                      : 'border-slate-200/80 hover:border-teal-300'
                  }`}
                >
                  {/* Top Meta Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-extrabold text-teal-900 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200/80">
                        {pid}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${info.badgeColor}`}>
                        {info.tag} (Level {sentence.level})
                      </span>
                      {sentence.category && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          • {sentence.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isRetake ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                          <RotateCcw className="w-3 h-3 text-amber-700" />
                          <span>Retake Requested by Admin</span>
                        </span>
                      ) : hasRecorded ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Recorded ({takes.length} take{takes.length === 1 ? '' : 's'})</span>
                        </span>
                      ) : isAssigned ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                          <Sparkles className="w-3 h-3 text-teal-600" />
                          <span>Recommended Next</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          Prompt #{sentence.sentenceNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Prompt Text & Details */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <p className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        "{sentence.text}"
                      </p>

                      {sentence.instructionNotes && (
                        <p className="text-xs text-slate-500 font-medium tracking-wide">
                          ({sentence.instructionNotes})
                        </p>
                      )}

                      {/* Admin feedback if retake was flagged */}
                      {retakeRec?.reviewDecision?.reason && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 mt-1">
                          <strong>Admin Review Reason:</strong> "{retakeRec.reviewDecision.reason}"
                        </div>
                      )}
                    </div>

                    {/* Action: Corresponding Record Button */}
                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                      {hasRecorded && (
                        <button
                          type="button"
                          onClick={onOpenMyRecordings}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition"
                          title="Review submitted takes"
                        >
                          View Takes ({takes.length})
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onRecordSentence(sentence)}
                        className={`min-h-[42px] px-4 sm:px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 ${
                          isRetake
                            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                            : hasRecorded
                            ? 'bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200'
                            : 'bg-gradient-to-tr from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white shadow-teal-600/25'
                        }`}
                      >
                        {isRetake ? (
                          <>
                            <RotateCcw className="w-4 h-4" />
                            <span>Retake Audio Take</span>
                          </>
                        ) : hasRecorded ? (
                          <>
                            <Mic className="w-4 h-4 text-teal-700" />
                            <span>Record Take #{takes.length + 1}</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-4 h-4" />
                            <span>Record Prompt</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
