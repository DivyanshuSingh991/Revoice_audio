import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  FileAudio,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertCircle,
  Download,
  Search,
  Filter,
  ShieldCheck,
  History,
  HardDrive,
  RefreshCw,
  ExternalLink,
  Play,
  Pause,
  X,
  Volume2,
  ChevronRight,
  User as UserIcon,
  Mic,
  Layers,
  Sparkles,
  ListFilter,
  CheckSquare,
} from 'lucide-react';
import { Recording, User, Sentence, DeletionRequest, AuditLog, SentenceLevel, ReviewStatus } from '../../types';
import { formatDuration, formatDate, formatFileSize } from '../../utils/formatters';
import { audioStorageService } from '../../services/audioStorageService';

interface AdminDashboardProps {
  adminUser: User;
  allUsers: User[];
  allRecordings: Recording[];
  sentencesMap: Map<string, Sentence>;
  deletionRequests: DeletionRequest[];
  auditLogs: AuditLog[];
  onOpenReviews: () => void;
  onOpenDeletions: () => void;
  onOpenProfile?: () => void;
  onExportVerifiedDataset: () => Promise<void>;
  exportingDataset: boolean;
}

type DashboardViewMode = 'ledger' | 'participants' | 'prompts';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  allUsers,
  allRecordings,
  sentencesMap,
  deletionRequests,
  auditLogs,
  onOpenReviews,
  onOpenDeletions,
  onOpenProfile,
  onExportVerifiedDataset,
  exportingDataset,
}) => {
  const [viewMode, setViewMode] = useState<DashboardViewMode>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<SentenceLevel | 'all'>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewStatus | 'all'>('all');

  // Selected Participant for drilldown modal
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  // Audio Playback state
  const [playingRecId, setPlayingRecId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Metrics calculations
  const participants = useMemo(() => allUsers.filter((u) => u.role !== 'admin'), [allUsers]);
  const participantsMap = useMemo(() => {
    const map = new Map<string, User>();
    for (const p of participants) {
      if (p.participantId) {
        map.set(p.participantId, p);
      }
      map.set(p.id, p);
    }
    return map;
  }, [participants]);

  const participantIds = useMemo(() => participants.map((p) => p.participantId), [participants]);

  const reviewCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let retake = 0;

    for (const r of allRecordings) {
      const status = r.reviewStatus || 'pending';
      if (status === 'approved') approved++;
      else if (status === 'rejected') rejected++;
      else if (status === 'retake_required') retake++;
      else pending++;
    }

    return { pending, approved, rejected, retake };
  }, [allRecordings]);

  const pendingDeletionsCount = useMemo(() => {
    return deletionRequests.filter(
      (d) => d.status === 'Submitted' || d.status === 'Under Review' || d.status === 'Processing'
    ).length;
  }, [deletionRequests]);

  // Audio playback handler
  const handleTogglePlay = async (rec: Recording) => {
    if (playingRecId === rec.id) {
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
        } else {
          audioRef.current.pause();
          setPlayingRecId(null);
        }
      }
      return;
    }

    try {
      setAudioLoading(true);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      const blob = await audioStorageService.getAudioBlob(rec.localFilePath);
      if (!blob) {
        console.error('Audio blob not found:', rec.localFilePath);
        setAudioLoading(false);
        return;
      }
      const newUrl = URL.createObjectURL(blob);
      setAudioUrl(newUrl);
      setPlayingRecId(rec.id);
    } catch (err) {
      console.error('Failed to load audio for preview:', err);
    } finally {
      setAudioLoading(false);
    }
  };

  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play().catch((e) => console.log('Playback error:', e));
    }
  }, [audioUrl]);

  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Filtered recordings for the ledger view
  const filteredRecordings = useMemo(() => {
    return allRecordings.filter((rec) => {
      if (levelFilter !== 'all' && rec.level !== levelFilter) return false;
      if (reviewFilter !== 'all' && (rec.reviewStatus || 'pending') !== reviewFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sentence = sentencesMap.get(rec.sentenceId);
        const matchPrompt = (rec.promptId || rec.sentenceId).toLowerCase().includes(q);
        const matchRecId = (rec.recordingId || rec.id).toLowerCase().includes(q);
        const matchSpeaker = (rec.speakerId || rec.participantId).toLowerCase().includes(q);
        const speakerUser = participantsMap.get(rec.speakerId || rec.participantId);
        const matchName = speakerUser?.name.toLowerCase().includes(q);
        const matchText = sentence?.text.toLowerCase().includes(q);
        if (!matchPrompt && !matchRecId && !matchSpeaker && !matchName && !matchText) return false;
      }

      return true;
    });
  }, [allRecordings, levelFilter, reviewFilter, searchQuery, sentencesMap, participantsMap]);

  // Group recordings by Prompt ID for "Takes by Prompt" view
  const promptTakesAggregation = useMemo(() => {
    const map = new Map<
      string,
      {
        promptId: string;
        sentence?: Sentence;
        level: SentenceLevel;
        recordings: Recording[];
        distinctSpeakerIds: Set<string>;
      }
    >();

    // Seed master sentences so all prompts appear
    for (const [id, sentence] of sentencesMap.entries()) {
      const pid = sentence.promptId || id;
      if (!map.has(pid)) {
        map.set(pid, {
          promptId: pid,
          sentence,
          level: sentence.level,
          recordings: [],
          distinctSpeakerIds: new Set<string>(),
        });
      }
    }

    // Populate with actual recordings
    for (const rec of allRecordings) {
      const pid = rec.promptId || rec.sentenceId;
      const group = map.get(pid);
      const speakerId = rec.speakerId || rec.participantId;
      if (group) {
        group.recordings.push(rec);
        if (speakerId) group.distinctSpeakerIds.add(speakerId);
      } else {
        const s = sentencesMap.get(rec.sentenceId);
        map.set(pid, {
          promptId: pid,
          sentence: s,
          level: rec.level,
          recordings: [rec],
          distinctSpeakerIds: new Set<string>(speakerId ? [speakerId] : []),
        });
      }
    }

    const list = Array.from(map.values());

    // Sort by level and sentence number
    return list.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      const numA = a.sentence?.sentenceNumber || 0;
      const numB = b.sentence?.sentenceNumber || 0;
      return numA - numB;
    });
  }, [allRecordings, sentencesMap]);

  // Filtered prompt takes
  const filteredPromptTakes = useMemo(() => {
    return promptTakesAggregation.filter((group) => {
      if (levelFilter !== 'all' && group.level !== levelFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPid = group.promptId.toLowerCase().includes(q);
        const matchText = group.sentence?.text.toLowerCase().includes(q);
        const matchSpeaker = Array.from(group.distinctSpeakerIds).some((sid) =>
          sid.toLowerCase().includes(q)
        );
        if (!matchPid && !matchText && !matchSpeaker) return false;
      }
      return true;
    });
  }, [promptTakesAggregation, levelFilter, searchQuery]);

  // Selected participant drilldown object
  const activeParticipant = useMemo(() => {
    if (!selectedParticipantId) return null;
    return (
      participants.find((p) => p.participantId === selectedParticipantId || p.id === selectedParticipantId) ||
      null
    );
  }, [selectedParticipantId, participants]);

  // Selected participant's recordings
  const activeParticipantRecordings = useMemo(() => {
    if (!selectedParticipantId) return [];
    return allRecordings.filter(
      (r) =>
        r.participantId === selectedParticipantId ||
        r.speakerId === selectedParticipantId ||
        (activeParticipant && r.userId === activeParticipant.id)
    );
  }, [selectedParticipantId, allRecordings, activeParticipant]);

  // Helper badge for review status
  const renderStatusBadge = (status: ReviewStatus = 'pending') => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>APPROVED</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>REJECTED</span>
          </span>
        );
      case 'retake_required':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <RotateCcw className="w-3 h-3 text-amber-600" />
            <span>RETAKE REQUIRED</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" />
            <span>PENDING REVIEW</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-24 px-4 pt-4">
      {/* Hidden audio element for previews */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onEnded={() => setPlayingRecId(null)}
        onError={() => setPlayingRecId(null)}
        className="hidden"
      />

      {/* Top Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 shadow-xl border border-teal-900/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-400/30">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>ReVoice Clinical Administrator Console</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Acoustic Speech Corpus Management
            </h1>
            <p className="text-xs text-slate-300 max-w-lg">
              Manage cohort prompt progression, review clinical audio takes with quality checklists, and process withdrawal/deletion requests.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 border border-white/20 transition active:scale-95 shadow-xs"
                title="View Admin Profile, Ethics Undertaking & Credentials"
              >
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>Admin Profile & Ethics</span>
              </button>
            )}

            <button
              type="button"
              onClick={onExportVerifiedDataset}
              disabled={exportingDataset || reviewCounts.approved === 0}
              className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-teal-600/20 transition active:scale-95 disabled:opacity-40"
              title="Exports only approved recordings with valid consent re-verification"
            >
              {exportingDataset ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{exportingDataset ? 'Packaging...' : 'Export Verified Dataset (ZIP)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SYSTEM STORAGE & GOOGLE CLOUD STORAGE ARCHITECTURE BANNER */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-xs sm:text-sm">Storage Mode: Local System File Paths</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                DB Stores Path Pointer Only
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Audio binaries saved to system path: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">/system_storage/recordings/PART_XXX/...</code> · Database holds only metadata · Ready for Google Cloud Storage (GCS)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
          <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-mono text-[11px] border border-slate-200">
            gs://revoice-speech-corpus-prod
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-teal-50 text-teal-800 font-bold text-[10px] border border-teal-200">
            GCS Ready
          </span>
        </div>
      </div>

      {/* METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Participants Card - Click to view all Distinct Participants */}
        <div
          onClick={() => setViewMode('participants')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition shadow-xs group ${
            viewMode === 'participants' ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-200/80 hover:border-teal-300'
          }`}
          title="Click to view all distinct participants"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Participants</span>
            <Users className="w-4 h-4 text-teal-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            {participants.length}
          </div>
          <div className="text-[11px] text-teal-700 font-semibold mt-1 flex items-center gap-1">
            <span>View All Distinct IDs</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Total Takes Card - Click to view Takes by Prompt ID & Speakers */}
        <div
          onClick={() => setViewMode('prompts')}
          className={`p-4 rounded-2xl bg-white border cursor-pointer transition shadow-xs group ${
            viewMode === 'prompts' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200/80 hover:border-indigo-300'
          }`}
          title="Click to view takes by prompt, speakers, status and trial count"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Takes</span>
            <FileAudio className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            {allRecordings.length}
          </div>
          <div className="text-[11px] text-indigo-700 font-semibold mt-1 flex items-center gap-1">
            <span>View Takes by Prompt</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Review Status Queue */}
        <div
          onClick={onOpenReviews}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-amber-400 cursor-pointer transition shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Review Queue</span>
            <Clock className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono mt-1">
            {reviewCounts.pending}
            <span className="text-xs font-normal text-slate-400 ml-1">pending</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex gap-2">
            <span className="text-emerald-700 font-semibold">{reviewCounts.approved} approved</span>
            <span>·</span>
            <span className="text-rose-700 font-semibold">{reviewCounts.rejected} rejected</span>
          </div>
        </div>

        {/* Deletion & Erasure Requests */}
        <div
          onClick={onOpenDeletions}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-rose-400 cursor-pointer transition shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Erasure Requests</span>
            <RotateCcw className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono mt-1">
            {pendingDeletionsCount}
            <span className="text-xs font-normal text-slate-400 ml-1">active</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {deletionRequests.length} total requests filed
          </div>
        </div>
      </div>

      {/* VIEW SELECTOR SWITCHER TABS */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('ledger')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'ledger'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            <span>All Takes (Ledger)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('participants')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'participants'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-teal-600" />
            <span>By Participant ({participants.length} Distinct IDs)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('prompts')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'prompts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5 text-indigo-600" />
            <span>Takes by Prompt (Speakers & Trials)</span>
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-64 hidden sm:block">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID, name, prompt..."
            className="w-full rounded-xl bg-white border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500 shadow-xs"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: RECORDINGS LEDGER (Clicking Participant ID opens detail modal)   */}
      {/* ========================================================================= */}
      {viewMode === 'ledger' && (
        <div className="space-y-3 rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Pseudonymous Audio Corpus Ledger</h2>
              <p className="text-xs text-slate-500">
                Click on any <span className="font-semibold text-teal-700">Speaker ID</span> to inspect that participant's full details, prompts, trials, and approval status.
              </p>
            </div>

            {/* Level & Review Filters */}
            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-[11px] text-slate-500 font-semibold">Level:</span>
              {(['all', 1, 2, 3] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    levelFilter === lvl
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl === 'all' ? 'All' : `L${lvl}`}
                </button>
              ))}

              <span className="text-slate-300 mx-1">|</span>

              <span className="text-[11px] text-slate-500 font-semibold">Status:</span>
              {(['all', 'approved', 'pending', 'rejected', 'retake_required'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setReviewFilter(st)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-medium capitalize transition ${
                    reviewFilter === st
                      ? 'bg-teal-600 text-white font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {st === 'retake_required' ? 'Retake' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3 whitespace-nowrap">Play</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Recording ID</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Speaker ID (Click for Profile)</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Prompt ID</th>
                  <th className="py-2.5 px-4 min-w-[200px]">Prompt Text</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Trial / Attempt</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Cohort</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Duration</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Approval Status</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Upload Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecordings.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No recordings found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecordings.map((rec) => {
                    const sentence = sentencesMap.get(rec.sentenceId);
                    const promptId = rec.promptId || sentence?.promptId || rec.sentenceId;
                    const speakerId = rec.speakerId || rec.participantId;
                    const recordingId = rec.recordingId || rec.id;
                    const speakerUser = participantsMap.get(speakerId);
                    const isPlaying = playingRecId === rec.id;

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                        {/* Play & Download Controls */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTogglePlay(rec)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition shadow-xs ${
                                isPlaying
                                  ? 'bg-amber-500 text-white animate-pulse'
                                  : 'bg-teal-50 hover:bg-teal-100 text-teal-700'
                              }`}
                              title={isPlaying ? 'Pause' : 'Play Audio Take'}
                            >
                              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => audioStorageService.downloadAudioFileToLocalDisk(rec.localFilePath, `${recordingId}.wav`)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition shadow-xs"
                              title="Download WAV to Local Machine"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Recording ID */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-sky-800">
                          {recordingId}
                        </td>

                        {/* Speaker ID (Clickable) */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedParticipantId(speakerId)}
                            className="font-mono font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-1.5 text-left"
                            title="Click to view participant recordings and status"
                          >
                            <span>{speakerId}</span>
                            {speakerUser && (
                              <span className="font-sans text-[11px] font-normal text-slate-500">
                                ({speakerUser.name})
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Prompt ID */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-amber-700">
                          {promptId}
                        </td>

                        {/* Prompt Text */}
                        <td className="py-2.5 px-4 text-slate-800 font-medium max-w-xs truncate">
                          {sentence ? sentence.text : 'Unknown sentence'}
                        </td>

                        {/* Trial / Attempt Count */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                            Trial #{rec.attemptNumber || 1}
                          </span>
                        </td>

                        {/* Cohort */}
                        <td className="py-2.5 px-3 whitespace-nowrap capitalize text-slate-600">
                          {rec.cohort || 'healthy'}
                        </td>

                        {/* Duration */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600">
                          {formatDuration(rec.duration)}
                        </td>

                        {/* Approval Status */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {renderStatusBadge(rec.reviewStatus)}
                        </td>

                        {/* Upload Date */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                          {formatDate(rec.timestamp)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DISTINCT PARTICIPANTS LIST (Click ID for full recording inventory) */}
      {/* ========================================================================= */}
      {viewMode === 'participants' && (
        <div className="space-y-4 rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Distinct Participants Directory</h2>
              <p className="text-xs text-slate-500">
                Click on any participant card or ID to view their full recording catalog, prompt sentences, and approval status.
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-teal-50 text-teal-800 px-3 py-1 rounded-xl border border-teal-200">
              {participants.length} Distinct Participant IDs Created
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {participants.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                No participants registered in database yet.
              </div>
            ) : (
              participants.map((p) => {
                const userRecs = allRecordings.filter(
                  (r) => r.participantId === p.participantId || r.speakerId === p.participantId || r.userId === p.id
                );
                const approvedCount = userRecs.filter((r) => r.reviewStatus === 'approved').length;
                const pendingCount = userRecs.filter((r) => (r.reviewStatus || 'pending') === 'pending').length;
                const retakeCount = userRecs.filter((r) => r.reviewStatus === 'retake_required').length;

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedParticipantId(p.participantId)}
                    className="p-4 rounded-2xl border border-slate-200/90 hover:border-teal-400 bg-slate-50/50 hover:bg-white cursor-pointer transition shadow-xs space-y-3 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                          {p.name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase() || 'P'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm group-hover:text-teal-700 transition">
                              {p.name}
                            </span>
                          </div>
                          <div className="font-mono font-bold text-xs text-teal-700">
                            {p.participantId}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          p.cohort === 'speech_impaired'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {p.cohort === 'speech_impaired' ? 'Speech-Impaired' : 'Healthy Cohort'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2 font-mono">
                      <span>{p.mobileNumber ? `📱 +91 ${p.mobileNumber}` : p.email}</span>
                      <span className="font-medium text-slate-400">
                        {p.gender ? `Gender: ${p.gender}` : ''}
                      </span>
                    </div>

                    {/* Takes & Status Summary */}
                    <div className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-slate-100 font-mono">
                      <div>
                        <span className="text-slate-400 text-[10px] block">TOTAL TAKES</span>
                        <span className="font-bold text-slate-900">{userRecs.length}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">APPROVED</span>
                        <span className="font-bold text-emerald-700">{approvedCount}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">PENDING</span>
                        <span className="font-bold text-blue-700">{pendingCount}</span>
                      </div>
                      {retakeCount > 0 && (
                        <div>
                          <span className="text-slate-400 text-[10px] block">RETAKE</span>
                          <span className="font-bold text-amber-700">{retakeCount}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-teal-700 font-semibold pt-1">
                      <span>Click to view recordings & prompts</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================================================= */}
      {/* VIEW 3: TAKES BY PROMPT (Prompt ID, Which Speakers have spoken it, their status, trial count & audio)    */}
      {/* ========================================================================================================= */}
      {viewMode === 'prompts' && (
        <div className="space-y-4 rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Corpus Takes by Prompt ID</h2>
              <p className="text-xs text-slate-500">
                Shows each prompt sentence, all speakers who have recorded it, their approval status, trial attempts, and direct playback.
              </p>
            </div>

            {/* Level Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] text-slate-500 font-semibold">Level:</span>
              {(['all', 1, 2, 3] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    levelFilter === lvl
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl === 'all' ? 'All Levels' : `Level ${lvl}`}
                </button>
              ))}
            </div>
          </div>

          {/* Prompts Accordion/List */}
          <div className="space-y-3">
            {filteredPromptTakes.map((group) => {
              const { promptId, sentence, level, recordings: promptRecs, distinctSpeakerIds } = group;

              return (
                <div
                  key={promptId}
                  className="p-4 rounded-2xl border border-slate-200/90 bg-white hover:border-indigo-300 transition shadow-xs space-y-3"
                >
                  {/* Prompt Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-bold text-xs bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-md border border-amber-200">
                        {promptId}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        Level {level}
                      </span>
                      {sentence?.category && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {sentence.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-semibold text-slate-700">
                        <span className="text-indigo-600 font-bold">{distinctSpeakerIds.size}</span> distinct speaker{distinctSpeakerIds.size === 1 ? '' : 's'}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-slate-700">
                        <span className="text-teal-600 font-bold">{promptRecs.length}</span> total take{promptRecs.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {/* Prompt Text */}
                  <div className="space-y-0.5">
                    <p className="text-sm sm:text-base font-bold text-slate-900">
                      "{sentence ? sentence.text : 'Prompt Text'}"
                    </p>
                    {sentence?.instructionNotes && (
                      <p className="text-xs text-slate-500 font-medium">
                        Notes: {sentence.instructionNotes}
                      </p>
                    )}
                  </div>

                  {/* Speakers Who Have Spoken This Prompt */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Speakers & Recording Takes ({promptRecs.length}):
                    </div>

                    {promptRecs.length === 0 ? (
                      <div className="py-3 px-3.5 rounded-xl bg-slate-50 text-slate-400 text-xs italic">
                        No participant has submitted a recording for this prompt yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/40">
                        {promptRecs.map((rec) => {
                          const speakerId = rec.speakerId || rec.participantId;
                          const speakerUser = participantsMap.get(speakerId);
                          const isPlaying = playingRecId === rec.id;

                          return (
                            <div
                              key={rec.id}
                              className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white transition"
                            >
                              {/* Left: Speaker info & Trial count */}
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlay(rec)}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition shadow-xs shrink-0 ${
                                    isPlaying
                                      ? 'bg-amber-500 text-white animate-pulse'
                                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                                  }`}
                                  title={isPlaying ? 'Pause' : 'Listen to this take'}
                                >
                                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                </button>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedParticipantId(speakerId)}
                                      className="font-mono font-bold text-teal-700 hover:underline text-xs"
                                    >
                                      {speakerId}
                                    </button>
                                    {speakerUser && (
                                      <span className="font-semibold text-slate-800">
                                        ({speakerUser.name})
                                      </span>
                                    )}
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                        rec.cohort === 'speech_impaired'
                                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      }`}
                                    >
                                      {rec.cohort === 'speech_impaired' ? 'Speech-Impaired' : 'Healthy'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-[11px] font-mono">
                                    <span className="font-bold text-slate-700">
                                      Trial / Attempt #{rec.attemptNumber || 1}
                                    </span>
                                    <span>·</span>
                                    <span>{rec.recordingId || rec.id}</span>
                                    <span>·</span>
                                    <span>{formatDuration(rec.duration)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Approval Status & Date */}
                              <div className="flex items-center gap-3 self-end sm:self-center">
                                <div>{renderStatusBadge(rec.reviewStatus)}</div>
                                <span className="text-slate-400 text-[11px]">
                                  {formatDate(rec.timestamp)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PARTICIPANT DETAIL MODAL (Opens when clicking any Participant ID)        */}
      {/* ========================================================================= */}
      {selectedParticipantId && activeParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold bg-teal-400 text-teal-950 px-2.5 py-0.5 rounded-md">
                    {activeParticipant.participantId}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/20 capitalize font-medium">
                    {activeParticipant.cohort === 'speech_impaired' ? 'Speech-Impaired Cohort' : 'Healthy Cohort'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white">
                  {activeParticipant.name}
                </h3>
                <p className="text-xs text-teal-200/80 font-mono">
                  {activeParticipant.mobileNumber ? `📱 +91 ${activeParticipant.mobileNumber}` : activeParticipant.email} · Registered: {formatDate(activeParticipant.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedParticipantId(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Subheader Summary Badges */}
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200/70 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-700">
                  Total Takes: <strong className="text-slate-900 font-mono">{activeParticipantRecordings.length}</strong>
                </span>
                <span>·</span>
                <span className="text-emerald-700 font-semibold">
                  Approved: <strong className="font-mono">{activeParticipantRecordings.filter((r) => r.reviewStatus === 'approved').length}</strong>
                </span>
                <span>·</span>
                <span className="text-blue-700 font-semibold">
                  Pending: <strong className="font-mono">{activeParticipantRecordings.filter((r) => (r.reviewStatus || 'pending') === 'pending').length}</strong>
                </span>
                <span>·</span>
                <span className="text-rose-700 font-semibold">
                  Rejected: <strong className="font-mono">{activeParticipantRecordings.filter((r) => r.reviewStatus === 'rejected').length}</strong>
                </span>
              </div>

              <div className="text-[11px] text-slate-500">
                Demographics: {activeParticipant.gender || 'Unspecified'} {activeParticipant.age ? `(${activeParticipant.age} yrs)` : ''}
              </div>
            </div>

            {/* Modal Content: Participant's Recordings Inventory */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Submitted Recordings & Prompts for {activeParticipant.name} ({activeParticipant.participantId})
              </h4>

              {activeParticipantRecordings.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  This participant has not submitted any audio recordings yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {activeParticipantRecordings.map((rec) => {
                    const sentence = sentencesMap.get(rec.sentenceId);
                    const promptId = rec.promptId || sentence?.promptId || rec.sentenceId;
                    const isPlaying = playingRecId === rec.id;

                    return (
                      <div
                        key={rec.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-teal-300 transition shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Audio Play Button + Details */}
                        <div className="flex items-start sm:items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleTogglePlay(rec)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition shadow-xs shrink-0 ${
                              isPlaying
                                ? 'bg-amber-500 text-white animate-pulse'
                                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/20'
                            }`}
                            title={isPlaying ? 'Pause' : 'Play audio take'}
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                                {promptId}
                              </span>
                              <span className="font-mono text-xs font-bold text-sky-800">
                                {rec.recordingId || rec.id}
                              </span>
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                                Trial #{rec.attemptNumber || 1}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                Level {rec.level}
                              </span>
                            </div>

                            <p className="text-sm font-bold text-slate-900">
                              "{sentence ? sentence.text : 'Unknown sentence prompt'}"
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                              <span>Duration: {formatDuration(rec.duration)}</span>
                              <span>·</span>
                              <span>Size: {formatFileSize(rec.fileSize)}</span>
                              <span>·</span>
                              <span>Date: {formatDate(rec.timestamp)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="self-end sm:self-center shrink-0">
                          {renderStatusBadge(rec.reviewStatus)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Canonical Speaker ID: <strong className="font-mono text-slate-800">{activeParticipant.participantId}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedParticipantId(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMINISTRATIVE AUDIT TRAIL */}
      <div className="space-y-3 rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-900">Administrative Action Audit Trail</h2>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No audit events recorded yet.</p>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
              >
                <div>
                  <span className="font-mono font-bold text-slate-800 mr-2">{log.action}</span>
                  <span className="text-slate-600">{log.details}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono shrink-0">
                  {formatDate(log.timestamp)} · by {log.performedBy}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
