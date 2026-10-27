import React, { useState, useMemo } from 'react';
import {
  Mic,
  Search,
  CheckCircle2,
  Play,
  ArrowLeft,
  Filter,
  Table as TableIcon,
  LayoutGrid,
  Download,
} from 'lucide-react';
import { Sentence, SentenceLevel, Recording } from '../../types';
import { formatSentenceId } from '../../utils/formatters';

interface SentenceListScreenProps {
  initialLevel?: SentenceLevel | 'all';
  sentences: Sentence[];
  recordings: Recording[];
  hasConsent: boolean;
  onRecordSentence: (sentence: Sentence) => void;
  onPlayRecording: (recording: Recording) => void;
  onBackToDashboard: () => void;
  onOpenConsentRequired: () => void;
}

export const SentenceListScreen: React.FC<SentenceListScreenProps> = ({
  initialLevel = 'all',
  sentences,
  recordings,
  hasConsent,
  onRecordSentence,
  onPlayRecording,
  onBackToDashboard,
  onOpenConsentRequired,
}) => {
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<SentenceLevel | 'all'>(initialLevel);
  const [statusFilter, setStatusFilter] = useState<'all' | 'recorded' | 'unrecorded'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Map sentenceId to recordings
  const sentenceRecordingsMap = useMemo(() => {
    const map = new Map<string, Recording[]>();
    for (const rec of recordings) {
      const list = map.get(rec.sentenceId) || [];
      list.push(rec);
      map.set(rec.sentenceId, list);
    }
    return map;
  }, [recordings]);

  // Filter sentences
  const filteredSentences = useMemo(() => {
    return sentences.filter((s) => {
      // Level filter
      if (selectedLevelFilter !== 'all' && s.level !== selectedLevelFilter) {
        return false;
      }

      // Status filter
      const takes = sentenceRecordingsMap.get(s.id) || [];
      const isRecorded = takes.length > 0;
      if (statusFilter === 'recorded' && !isRecorded) return false;
      if (statusFilter === 'unrecorded' && isRecorded) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const displayId = (s.promptId || s.id || formatSentenceId(s.level, s.sentenceNumber)).toLowerCase();
        const matchText = s.text.toLowerCase().includes(query);
        const matchNotes = s.instructionNotes ? s.instructionNotes.toLowerCase().includes(query) : false;
        const matchCategory = s.category ? s.category.toLowerCase().includes(query) : false;
        const matchId = displayId.includes(query) || s.id.toLowerCase().includes(query);
        if (!matchText && !matchNotes && !matchCategory && !matchId) return false;
      }

      return true;
    });
  }, [sentences, selectedLevelFilter, statusFilter, searchQuery, sentenceRecordingsMap]);

  const handleRecordClick = (sentence: Sentence) => {
    if (!hasConsent) {
      onOpenConsentRequired();
      return;
    }
    onRecordSentence(sentence);
  };

  const handleExportSentencesCsv = () => {
    const header = ['prompt_id', 'difficulty_level', 'category', 'prompt_text_devanagari', 'instruction_notes', 'status', 'takes_count'].join(',');
    const rows = sentences.map((s) => {
      const takes = sentenceRecordingsMap.get(s.id) || [];
      const status = takes.length > 0 ? 'recorded' : 'unrecorded';
      return [
        s.promptId || s.id,
        `"${(s.difficultyLevel || `Level ${s.level}`).replace(/"/g, '""')}"`,
        `"${(s.category || '').replace(/"/g, '""')}"`,
        `"${s.text.replace(/"/g, '""')}"`,
        `"${(s.instructionNotes || '').replace(/"/g, '""')}"`,
        status,
        takes.length,
      ].join(',');
    });

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revoice_sentences_table_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 pb-24 px-4 pt-3">
      {/* Top Header & Back Button */}
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
          <h1 className="text-base font-bold text-slate-900">Sentence Corpus Catalog</h1>
          <p className="text-xs text-teal-700 font-medium">
            {selectedLevelFilter === 'all'
              ? 'All 30 Prompts & Speech Modules'
              : `Level ${selectedLevelFilter} Module`}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              viewMode === 'table'
                ? 'bg-white text-teal-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Table View (Database registry)"
          >
            <TableIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              viewMode === 'cards'
                ? 'bg-white text-teal-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Cards View"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Cards</span>
          </button>
        </div>
      </div>

      {/* Prompt Catalog Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-teal-700/50 border border-teal-500/30 text-teal-200 shrink-0">
              <TableIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold tracking-wider uppercase bg-teal-500/30 text-teal-200 px-2 py-0.5 rounded border border-teal-400/30">
                  Prompt Library
                </span>
                <span className="text-xs text-slate-300">
                  30 Standardized Research Sentences
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Phonemically balanced phrases across 3 levels designed for clinical voice acoustic modeling and speech recognition.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportSentencesCsv}
            className="self-start sm:self-center shrink-0 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs border border-teal-400/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Catalog (CSV)</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="space-y-3 rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts by Hindi text, category, or difficulty..."
            className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Level Filters (Interactive Segmented Control) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-slate-500 mr-1 flex items-center gap-1 font-semibold">
            <Filter className="w-3 h-3 text-teal-600" />
            <span>Module:</span>
          </span>
          {(['all', 1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSelectedLevelFilter(lvl)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition active:scale-95 font-semibold text-xs ${
                selectedLevelFilter === lvl
                  ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/30'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {lvl === 'all' ? 'All Levels (30)' : `Level ${lvl} (10)`}
            </button>
          ))}
        </div>

        {/* Status Filters (All / Recorded / Unrecorded) */}
        <div className="flex items-center gap-1.5 text-xs pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-500 mr-1 font-medium">Status:</span>
          {(['all', 'unrecorded', 'recorded'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md text-[11px] capitalize transition font-medium ${
                statusFilter === st
                  ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
          <span className="ml-auto text-[11px] font-mono text-slate-500">
            {filteredSentences.length} of {sentences.length} sentences
          </span>
        </div>
      </div>

      {/* VIEW: TABLE VIEW */}
      {viewMode === 'table' ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-3.5 whitespace-nowrap text-center">Prompt #</th>
                  <th className="py-3 px-3 whitespace-nowrap">Level</th>
                  <th className="py-3 px-3 whitespace-nowrap">Category</th>
                  <th className="py-3 px-4 min-w-[280px]">Prompt Text</th>
                  <th className="py-3 px-4 min-w-[260px]">Pronunciation & Notes</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Takes</th>
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSentences.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No prompts found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredSentences.map((sentence) => {
                    const takes = sentenceRecordingsMap.get(sentence.id) || [];
                    const isRecorded = takes.length > 0;
                    const latestTake = isRecorded ? takes[0] : null;

                    return (
                      <tr
                        key={sentence.id}
                        className={`hover:bg-teal-50/30 transition ${
                          isRecorded ? 'bg-emerald-50/15' : ''
                        }`}
                      >
                        {/* Prompt Number */}
                        <td className="py-3 px-3.5 whitespace-nowrap text-center">
                          <span className="inline-flex items-center justify-center w-8 h-7 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200">
                            #{sentence.sentenceNumber}
                          </span>
                        </td>

                        {/* Difficulty Level */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-700 font-medium">
                          {sentence.difficultyLevel || `Level ${sentence.level}`}
                        </td>

                        {/* Category */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium">
                            {sentence.category || 'General'}
                          </span>
                        </td>

                        {/* Hindi Devanagari Prompt */}
                        <td className="py-3 px-4 font-bold text-slate-900 text-sm leading-relaxed">
                          {sentence.text}
                        </td>

                        {/* Instruction Notes / Hinglish */}
                        <td className="py-3 px-4 text-slate-500 font-medium text-xs leading-relaxed">
                          {sentence.instructionNotes ? (
                            <span>{sentence.instructionNotes}</span>
                          ) : (
                            <span className="italic text-slate-400">—</span>
                          )}
                        </td>

                        {/* Takes & Status */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {isRecorded ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{takes.length} take{takes.length > 1 ? 's' : ''}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[11px]">
                              0 takes
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {latestTake && (
                              <button
                                type="button"
                                onClick={() => onPlayRecording(latestTake)}
                                className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 transition"
                                title="Listen to latest take"
                              >
                                <Play className="w-3.5 h-3.5 fill-current text-teal-700" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRecordClick(sentence)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition ${
                                isRecorded
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                                  : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                              }`}
                            >
                              <Mic className="w-3.5 h-3.5" />
                              <span>{isRecorded ? 'Re-record' : 'Record'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW: CARDS VIEW */
        <div className="space-y-2.5">
          {filteredSentences.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white border border-slate-200/80 text-slate-500">
              <p className="text-sm font-semibold text-slate-800">No sentences found matching criteria.</p>
              <p className="text-xs mt-1">Try resetting the search query or status filter.</p>
            </div>
          ) : (
            filteredSentences.map((sentence) => {
              const takes = sentenceRecordingsMap.get(sentence.id) || [];
              const isRecorded = takes.length > 0;
              const latestTake = isRecorded ? takes[0] : null;

              return (
                <div
                  key={sentence.id}
                  className={`p-4 rounded-2xl transition border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-slate-200/80 hover:border-teal-300 shadow-xs ${
                    isRecorded ? 'bg-gradient-to-r from-white to-teal-50/20' : ''
                  }`}
                >
                  {/* Sentence Info */}
                  <div className="space-y-1.5 flex-1 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-900 font-bold text-xs border border-teal-200/80">
                        Prompt #{sentence.sentenceNumber}
                      </span>

                      <span className="text-[11px] text-slate-600 font-semibold">
                        {sentence.difficultyLevel || `Level ${sentence.level}`}
                      </span>

                      {sentence.category && (
                        <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium border border-teal-200/60">
                          {sentence.category}
                        </span>
                      )}

                      {isRecorded ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Recorded ({takes.length} take{takes.length > 1 ? 's' : ''})</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium border border-amber-200/60">
                          Unrecorded
                        </span>
                      )}
                    </div>

                    {/* Main prompt text in Hindi (Devanagari script) */}
                    <p className="text-base text-slate-900 font-bold leading-relaxed pt-0.5">
                      "{sentence.text}"
                    </p>

                    {/* Hinglish pronunciation / transliteration in parentheses directly below */}
                    {sentence.instructionNotes && (
                      <p className="text-xs text-slate-500 font-medium tracking-wide">
                        ({sentence.instructionNotes})
                      </p>
                    )}
                  </div>

                  {/* Actions: Record & Play shortcut */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto justify-end">
                    {latestTake && (
                      <button
                        type="button"
                        onClick={() => onPlayRecording(latestTake)}
                        className="min-h-[42px] px-3 rounded-xl bg-teal-50 hover:bg-teal-100/70 text-teal-800 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 border border-teal-200/70 shadow-xs"
                        title="Listen to latest take"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-teal-600" />
                        <span>Listen</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRecordClick(sentence)}
                      className={`min-h-[42px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition active:scale-95 shadow-sm ${
                        isRecorded
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                          : 'bg-gradient-to-tr from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white shadow-teal-600/20'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                      <span>{isRecorded ? 'Re-record' : 'Record'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
