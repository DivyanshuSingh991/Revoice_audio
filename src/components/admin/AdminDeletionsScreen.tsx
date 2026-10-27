import React, { useState } from 'react';
import {
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  Send,
} from 'lucide-react';
import { DeletionRequest, DeletionRequestStatus, User } from '../../types';
import { formatDate } from '../../utils/formatters';
import { deletionService } from '../../services/deletionService';

interface AdminDeletionsScreenProps {
  adminUser: User;
  requests: DeletionRequest[];
  onRequestsUpdated: () => Promise<void>;
}

export const AdminDeletionsScreen: React.FC<AdminDeletionsScreenProps> = ({
  adminUser,
  requests,
  onRequestsUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeletionRequestStatus | 'all'>('all');

  // Selected request for processing
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<DeletionRequestStatus>('Under Review');
  const [staffNote, setStaffNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredRequests = requests.filter((req) => {
    if (statusFilter !== 'all' && req.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = req.id.toLowerCase().includes(q);
      const matchParticipant = req.participantId.toLowerCase().includes(q);
      const matchStaff = req.assignedStaff.toLowerCase().includes(q);
      if (!matchId && !matchParticipant && !matchStaff) return false;
    }
    return true;
  });

  const handleOpenProcessModal = (req: DeletionRequest) => {
    setSelectedRequest(req);
    setSelectedStatus(req.status);
    setStaffNote('');
    setFeedback(null);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setProcessing(true);
    setFeedback(null);

    try {
      await deletionService.updateStatus(
        selectedRequest.id,
        selectedStatus,
        adminUser.email,
        staffNote.trim()
      );
      setFeedback(`Request ${selectedRequest.id} successfully updated to ${selectedStatus}.`);
      await onRequestsUpdated();
      setSelectedRequest(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFeedback(err.message);
      } else {
        setFeedback('Failed to update request.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const statusBadge = (status: DeletionRequestStatus) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Completed (Purged)
          </span>
        );
      case 'Processing':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            Processing
          </span>
        );
      case 'Under Review':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            Under Review
          </span>
        );
      case 'Partially Completed / Exception Recorded':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
            Exception Recorded
          </span>
        );
      case 'Submitted':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            Submitted (Pending)
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-24 px-4 pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Withdrawal & Data Deletion Requests</h1>
          <p className="text-xs text-slate-500">
            Process participant consent withdrawals and verified audio erasures with confirmed audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            {requests.length} total request{requests.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="space-y-3 rounded-2xl bg-white p-4 border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Request ID, Participant ID (e.g. SPK_0001), or assigned staff..."
            className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
          <span className="text-[11px] text-slate-500 font-semibold">Status:</span>
          {(['all', 'Submitted', 'Under Review', 'Processing', 'Completed', 'Partially Completed / Exception Recorded'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Ledger Table */}
      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-3 px-3.5 whitespace-nowrap">Request ID</th>
                <th className="py-3 px-3 whitespace-nowrap">Participant ID</th>
                <th className="py-3 px-3 whitespace-nowrap">Request Type</th>
                <th className="py-3 px-3 whitespace-nowrap text-center">Affected Takes</th>
                <th className="py-3 px-3 whitespace-nowrap">Assigned Staff</th>
                <th className="py-3 px-3 whitespace-nowrap">Current Status</th>
                <th className="py-3 px-3 whitespace-nowrap">Submission Date</th>
                <th className="py-3 px-3 whitespace-nowrap">Completion Date</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    No withdrawal or deletion requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {req.id}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-sky-800 whitespace-nowrap">
                      {req.participantId}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap capitalize text-slate-700 font-medium">
                      {req.requestType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-slate-800 font-semibold">
                      {req.affectedRecordingsCount} takes
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-600 truncate max-w-[150px]">
                      {req.assignedStaff}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {statusBadge(req.status)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                      {formatDate(req.submissionDate)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                      {req.completionDate ? formatDate(req.completionDate) : '—'}
                    </td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenProcessModal(req)}
                        className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs transition active:scale-95 border border-teal-200/80"
                      >
                        Process Request
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PROCESS STATUS MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Process Request: <span className="font-mono text-teal-800">{selectedRequest.id}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Participant: <span className="font-mono font-bold text-slate-800">{selectedRequest.participantId}</span> ({selectedRequest.affectedRecordingsCount} audio recording{selectedRequest.affectedRecordingsCount === 1 ? '' : 's'} linked)
                </p>
              </div>

              {statusBadge(selectedRequest.status)}
            </div>

            {selectedRequest.targetRecordingId && (
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 space-y-1">
                <span className="font-bold text-indigo-900">Target Audio Take to Delete:</span>
                <div className="flex items-center gap-2 font-mono font-bold text-indigo-800 text-[11px]">
                  <span className="bg-white px-2 py-0.5 rounded border border-indigo-200">
                    Take: {selectedRequest.targetRecordingId}
                  </span>
                  {selectedRequest.targetPromptId && (
                    <span className="bg-white px-2 py-0.5 rounded border border-indigo-200">
                      Prompt: {selectedRequest.targetPromptId}
                    </span>
                  )}
                </div>
              </div>
            )}

            {selectedRequest.notes && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <span className="font-bold text-slate-700">Participant Request Note:</span>
                <p className="text-slate-600 mt-0.5 italic">"{selectedRequest.notes}"</p>
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Update Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as DeletionRequestStatus)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500 font-medium"
                >
                  <option value="Submitted">Submitted (Queued)</option>
                  <option value="Under Review">Under Review (Assigned to Staff)</option>
                  <option value="Processing">Processing (Verifying Linked Datasets)</option>
                  <option value="Completed">Completed (Confirmed Erasure & Purge)</option>
                  <option value="Partially Completed / Exception Recorded">
                    Partially Completed / Exception Recorded
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Administrative Action Note</label>
                <textarea
                  rows={3}
                  value={staffNote}
                  onChange={(e) => setStaffNote(e.target.value)}
                  placeholder="e.g. Verified zero active research pipelines, purged WAV binary store, updated database state..."
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              {selectedStatus === 'Completed' && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Permanent Erasure Confirmation:</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {selectedRequest.targetRecordingId ? (
                      <>Setting this request to <strong>Completed</strong> will immediately and permanently delete audio take <strong>{selectedRequest.targetRecordingId}</strong> from local storage and database. Other recordings will be preserved.</>
                    ) : (
                      <>Setting this request to <strong>Completed</strong> will immediately purge all {selectedRequest.affectedRecordingsCount} local audio files and metadata for this participant. Do not mark completed unless confirmed.</>
                    )}
                  </p>
                </div>
              )}

              {/* Action History Trail */}
              {selectedRequest.actionHistory && selectedRequest.actionHistory.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px]">
                  <span className="font-bold text-slate-700">Audit History for this Request:</span>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedRequest.actionHistory.map((h, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-slate-600">
                        <span className="font-semibold text-slate-800">{h.status}</span> by {h.updatedBy} on {formatDate(h.timestamp)}
                        {h.comment && <p className="italic text-slate-500 mt-0.5">"{h.comment}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition disabled:opacity-50"
                >
                  {processing ? 'Saving...' : 'Update Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
