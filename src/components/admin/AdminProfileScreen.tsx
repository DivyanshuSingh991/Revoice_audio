import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  User as UserIcon,
  LogOut,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  HardDrive,
  Users,
  FileAudio,
  Eye,
  Check,
  RotateCcw,
  Shield,
  Layers,
  Fingerprint,
} from 'lucide-react';
import { User } from '../../types';
import { formatDate } from '../../utils/formatters';
import { authService } from '../../services/authService';
import { dbService } from '../../services/db';

interface AdminProfileScreenProps {
  adminUser: User;
  onLogout: () => void;
  onBackToDashboard: () => void;
  totalRecordingsCount: number;
  totalParticipantsCount: number;
}

export const AdminProfileScreen: React.FC<AdminProfileScreenProps> = ({
  adminUser,
  onLogout,
  onBackToDashboard,
  totalRecordingsCount,
  totalParticipantsCount,
}) => {
  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Ethics & Non-Disclosure Undertaking Affirmation State
  const [undertakingTimestamp, setUndertakingTimestamp] = useState<number>(() => {
    const saved = localStorage.getItem(`revoice_admin_nda_timestamp_${adminUser.id}`);
    return saved ? parseInt(saved, 10) : adminUser.createdAt;
  });
  const [affirmingNda, setAffirmingNda] = useState(false);
  const [affirmFeedback, setAffirmFeedback] = useState<string | null>(null);

  // Logout confirmation modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Handle password update
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError('Current administrator password is required.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters with high entropy.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      await dbService.addAuditLog({
        id: crypto.randomUUID(),
        action: 'ADMIN_PASSWORD_CHANGED',
        performedBy: adminUser.email,
        details: `Administrator credentials successfully updated with PBKDF2 hash renewal.`,
        timestamp: Date.now(),
      });

      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
      }, 1600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update administrator password.';
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle Re-affirmation of Data Non-Disclosure Undertaking
  const handleAffirmUndertaking = async () => {
    setAffirmingNda(true);
    setAffirmFeedback(null);
    try {
      const now = Date.now();
      localStorage.setItem(`revoice_admin_nda_timestamp_${adminUser.id}`, now.toString());
      setUndertakingTimestamp(now);

      await dbService.addAuditLog({
        id: crypto.randomUUID(),
        action: 'ADMIN_ETHICS_AFFIRMED',
        performedBy: adminUser.email,
        details: `ReVoice Clinical Administrator re-affirmed Non-Disclosure & Anti-Leakage Undertaking (NDA v2.4).`,
        timestamp: now,
      });

      setAffirmFeedback('Ethics & Non-Disclosure Undertaking re-affirmed and logged.');
      setTimeout(() => setAffirmFeedback(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setAffirmingNda(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 pb-24 px-4 pt-4 animate-fade-in">
      {/* Top Admin Identity Hero Card */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 shadow-xl border border-indigo-900/50 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-teal-400 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-600/30 ring-4 ring-indigo-500/20">
              <ShieldCheck className="w-9 h-9 stroke-[2.2]" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-md border border-indigo-400/40">
                  {adminUser.participantId || 'STAFF_0001'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold border border-teal-400/30">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  <span>Clinical Administrator Key</span>
                </span>
              </div>

              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                {adminUser.name}
              </h1>
              <p className="text-xs text-indigo-200/80 font-mono">
                {adminUser.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="px-4 py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-900/30 transition active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar inside Hero */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-indigo-900/60 text-xs">
          <div>
            <span className="text-indigo-300/70 text-[10px] block font-semibold uppercase">Clearance Level</span>
            <span className="font-bold text-white">Tier-1 Clinical Lead</span>
          </div>
          <div>
            <span className="text-indigo-300/70 text-[10px] block font-semibold uppercase">Managed Cohorts</span>
            <span className="font-bold text-teal-300">{totalParticipantsCount} Participants</span>
          </div>
          <div>
            <span className="text-indigo-300/70 text-[10px] block font-semibold uppercase">Total Corpus Audio</span>
            <span className="font-bold text-white">{totalRecordingsCount} Takes</span>
          </div>
          <div>
            <span className="text-indigo-300/70 text-[10px] block font-semibold uppercase">System Status</span>
            <span className="font-bold text-emerald-400">Authenticated & Active</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: INSTITUTIONAL NON-DISCLOSURE & ETHICS UNDERTAKING (ADMIN CONSENT) */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200/70">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Institutional Data Ethics & Non-Disclosure Undertaking
              </h2>
              <p className="text-xs text-slate-500">
                Mandatory institutional agreement governing access to participant voice recordings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Signed & Legally Binding</span>
            </span>
          </div>
        </div>

        {/* Legal Undertaking Clauses */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3 text-xs text-slate-700">
          <div className="space-y-1">
            <p className="font-bold text-slate-900 text-sm">
              Staff Administrator Undertaking & Covenant:
            </p>
            <p className="text-[11px] text-slate-500">
              As a credentialed clinical administrator for the ReVoice Acoustic Speech Corpus, I hereby undertake, warrant, and certify:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Clause 1 */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>1. Zero External Distribution & Anti-Leakage</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                I will <strong>NOT</strong> export, download, transfer, copy, email, publish, or disclose any participant voice recordings, raw PCM WAV binaries, or linked metadata outside the sandboxed ReVoice clinical platform.
              </p>
            </div>

            {/* Clause 2 */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>2. Strict Pseudonymity & Anti-Reidentification</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                I will strictly respect participant privacy. I will <strong>never attempt to de-anonymize</strong>, reverse-engineer, or link pseudonymous Speaker IDs (<code className="font-mono text-teal-800 font-bold">SPK_XXXX</code>) with external biometric, acoustic, or social identities.
              </p>
            </div>

            {/* Clause 3 */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <FileAudio className="w-4 h-4 text-teal-600 shrink-0" />
                <span>3. Consented Clinical Purpose Limitation</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                I will only access recordings for speech recognition accessibility models and verified clinical acoustic research explicitly authorized by participant informed consent.
              </p>
            </div>

            {/* Clause 4 */}
            <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>4. Immutable Audit Accountability</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                I acknowledge that all my administrative actions—including auditioning, review decisions, deletion processing, and exports—are cryptographically recorded in the permanent audit trail.
              </p>
            </div>
          </div>

          {/* Undertaking Digital Signature Verification Footnote */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 text-[11px]">
            <div className="space-y-0.5">
              <div className="text-slate-600">
                Digital Affirmation Record: <span className="font-mono font-bold text-slate-900">{adminUser.email}</span>
              </div>
              <div className="text-slate-400">
                Affirmed On: {formatDate(undertakingTimestamp)} · Policy Version: IRB-NDA-v2.6-2026
              </div>
            </div>

            <div className="flex items-center gap-2">
              {affirmFeedback && (
                <span className="text-emerald-700 font-semibold animate-pulse">
                  {affirmFeedback}
                </span>
              )}
              <button
                type="button"
                onClick={handleAffirmUndertaking}
                disabled={affirmingNda}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition active:scale-95 disabled:opacity-50 text-[11px] flex items-center gap-1.5"
              >
                {affirmingNda ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Affirm & Re-sign Undertaking</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: GRANTED BASIC DETAILS & ADMINISTRATIVE CAPABILITIES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Details Granted Card */}
        <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <UserIcon className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Administrator Profile & Authority
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Full Name</span>
              <span className="font-bold text-slate-900">{adminUser.name}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Canonical Staff ID</span>
              <span className="font-mono font-bold text-indigo-700">{adminUser.participantId}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Designated Institutional Email</span>
              <span className="font-mono font-medium text-slate-800">{adminUser.email}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Assigned System Role</span>
              <span className="font-bold text-teal-800 uppercase text-[11px] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                {adminUser.role} (Super Admin)
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Account Initialized</span>
              <span className="text-slate-700">{formatDate(adminUser.createdAt)}</span>
            </div>

            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Authentication Scheme</span>
              <span className="font-mono text-[11px] text-slate-600">PBKDF2-SHA256 (Salted)</span>
            </div>
          </div>
        </div>

        {/* Granted Capabilities Card */}
        <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <Layers className="w-4 h-4 text-teal-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Authorized Administrative Privileges
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">Acoustic Auditioning & Waveform Inspection</p>
                <p className="text-[11px] text-slate-500">Direct streaming access to 16kHz PCM WAV recordings for clinical review.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">Quality Checklist & Review Approvals</p>
                <p className="text-[11px] text-slate-500">Authorize recordings as Approved, Rejected, or Request Retake with logged reasons.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">Verified Deletion & Physical Erasure Execution</p>
                <p className="text-[11px] text-slate-500">Execute verified removal of participant audio files and records upon request completion.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900">Verified Research Dataset Packaging</p>
                <p className="text-[11px] text-slate-500">Export verified research corpus ZIP bundles with consent re-check filters.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: CREDENTIALS & SECURITY */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Staff Credentials & Security</h3>
            <p className="text-xs text-slate-500">
              Update administrator password or refresh session keys.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPasswordModal(true)}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95 border border-slate-200 flex items-center gap-1.5 self-start sm:self-center"
        >
          <KeyRound className="w-3.5 h-3.5 text-slate-600" />
          <span>Change Admin Password</span>
        </button>
      </div>

      {/* SECTION 4: DEDICATED LOGOUT PANEL */}
      <div className="rounded-3xl bg-rose-50/60 border border-rose-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-rose-950 text-sm">Terminate Administrator Session</h3>
            <p className="text-xs text-rose-800/80">
              Securely sign out of the ReVoice Administrator Console and close active authorization keys.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 transition active:scale-95 self-start sm:self-center"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out of Admin Console</span>
        </button>
      </div>

      {/* MODAL: CHANGE ADMIN PASSWORD */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                <span>Update Administrator Password</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Administrator password successfully updated.</span>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Current Password:
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    New High-Entropy Password:
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Confirm New Password:
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                    placeholder="Re-enter new password"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
                  >
                    {passwordLoading ? (
                      <RotateCcw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Confirm Administrator Logout
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to end your administrative session for <span className="font-semibold text-slate-800">{adminUser.email}</span>?
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition active:scale-95"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
