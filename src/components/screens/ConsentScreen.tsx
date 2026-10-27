import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, FileText, ChevronDown, ChevronUp, CheckSquare, Square, Mail } from 'lucide-react';
import { authService, CURRENT_CONSENT_VERSION } from '../../services/authService';
import { User, ConsentRecord } from '../../types';

interface ConsentScreenProps {
  user: User;
  existingConsent?: ConsentRecord | null;
  onConsentComplete: (accepted: boolean) => void;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  user,
  existingConsent,
  onConsentComplete,
}) => {
  // Box starts unchecked by default; only checked when user explicitly checks it
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!agreedToTerms) {
      setErrorMessage('Please check the agreement box confirming you understand and accept the terms.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      await authService.recordConsent(
        user.id,
        [
          'voice_collection_purpose_accepted',
          'ai_voice_cloning_and_speech_rehabilitation_permitted',
          'data_privacy_and_secure_storage_acknowledged',
          'voluntary_participation_and_withdrawal_rights_understood',
          'data_deletion_rights_acknowledged',
          'ai_model_training_specifically_consented',
        ],
        'accepted'
      );
      onConsentComplete(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to save consent choice.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await authService.recordConsent(user.id, [], 'declined');
      onConsentComplete(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto min-h-screen px-4 py-8 flex flex-col justify-center">
      <div className="rounded-3xl bg-white p-5 md:p-6 border border-slate-200/80 shadow-2xl healthcast-card">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Audio Recording & Privacy Policy</h1>
            <p className="text-xs text-slate-500">
              ReVoice Audio Protocol Version: <span className="font-mono text-teal-700 font-bold">{CURRENT_CONSENT_VERSION}</span>
            </p>
          </div>
        </div>

        {/* Participant Identification Notice */}
        <div className="mt-4 p-3 rounded-xl bg-teal-50/50 border border-teal-100 text-xs text-slate-700 flex items-center justify-between">
          <span className="text-slate-500">Assigned Participant Code:</span>
          <span className="font-mono font-bold text-teal-900">{user.participantId}</span>
        </div>

        {/* Scrollable Summary of Consent Items */}
        <div className="mt-4 space-y-3 max-h-[380px] overflow-y-auto pr-1 text-xs text-slate-600">
          {/* Voluntary agreement statement */}
          <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs text-slate-800 leading-relaxed font-medium">
            I voluntarily agree to provide my voice recordings to <strong className="font-bold text-teal-900">ReVoice</strong> for developing and improving AI-based voice cloning and speech rehabilitation technology.
          </div>

          <p className="font-bold text-slate-800 px-1 pt-1">I understand that:</p>

          {/* 1. Purpose */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h3 className="font-bold text-slate-800 mb-1">1. Purpose</h3>
            <p className="leading-relaxed">
              My recordings may be used to create, train, test, and improve voice-cloning models for speech generation.
            </p>
          </div>

          {/* 2. Data Privacy */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h3 className="font-bold text-slate-800 mb-1">2. Data Privacy</h3>
            <p className="leading-relaxed">
              My recordings and related data will be stored securely and accessed only by authorised persons for the stated purposes.
            </p>
          </div>

          {/* 3. Voluntary Participation */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h3 className="font-bold text-slate-800 mb-1">3. Voluntary Participation</h3>
            <p className="leading-relaxed">
              My participation is voluntary. I may withdraw my consent by using withdraw consent option on this website or through contacting on email:{' '}
              <a href="mailto:revoicegenai@gmail.com" className="text-teal-700 font-semibold underline">
                revoicegenai@gmail.com
              </a>.
            </p>
          </div>

          {/* 4. Data Deletion */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h3 className="font-bold text-slate-800 mb-1">4. Data Deletion</h3>
            <p className="leading-relaxed">
              I may request deletion of my recordings, subject to applicable law. However, removing recordings may not completely remove their influence from an already-trained AI model.
            </p>
          </div>

          {/* 5. Risks */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h3 className="font-bold text-slate-800 mb-1">5. Risks</h3>
            <p className="leading-relaxed">
              I have been informed about the purpose and potential privacy risks.
            </p>
          </div>

          {/* 6. Rights */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h3 className="font-bold text-slate-800 mb-1">6. Rights</h3>
            <p className="leading-relaxed">
              I may contact{' '}
              <a href="mailto:revoicegenai@gmail.com" className="text-teal-700 font-semibold underline">
                revoicegenai@gmail.com
              </a>{' '}
              for questions, complaints, or requests regarding my data.
            </p>
          </div>

          {/* Confirmation note */}
          <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200 text-slate-700 leading-relaxed font-medium">
            I confirm that I have read and understood this form, had the opportunity to ask questions, and freely agree to the use of my voice recordings for the purposes described above.
          </div>

          {/* Expand Full Protocol */}
          <button
            type="button"
            onClick={() => setExpandedDoc(!expandedDoc)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-teal-50 hover:bg-teal-100/70 text-xs text-teal-900 font-semibold transition border border-teal-200/60 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              <span>{expandedDoc ? 'Hide Additional Protocol Details' : 'View Additional Protocol Details'}</span>
            </span>
            {expandedDoc ? <ChevronUp className="w-4 h-4 text-teal-700" /> : <ChevronDown className="w-4 h-4 text-teal-700" />}
          </button>

          {expandedDoc && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-2 leading-relaxed">
              <p className="font-bold text-slate-800">
                ReVoice AI Audio & Model Training Protocol
              </p>
              <p>
                By granting consent, the participant authorizes the acquisition of digitised acoustic waveforms for machine learning and speech synthesis compilation. Recordings are sampled using 16-bit linear pulse code modulation (PCM). Data pseudonymization is maintained through participant identification code {user.participantId}.
              </p>
              <p>
                Storage security measures follow strict sandboxed storage encryption standards. For questions, complaints, or data deletion requests, contact revoicegenai@gmail.com.
              </p>
            </div>
          )}
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Explicit Agreement Checkbox - User must manually check */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setAgreedToTerms(!agreedToTerms);
              setErrorMessage(null);
            }}
            className="flex items-start gap-3 text-left group w-full cursor-pointer select-none"
          >
            <div className="mt-0.5 text-teal-600 group-hover:text-teal-700 shrink-0">
              {agreedToTerms ? (
                <CheckSquare className="w-5 h-5 fill-teal-600 text-white" />
              ) : (
                <Square className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
              )}
            </div>
            <div className="text-xs space-y-1">
              <span className="block font-bold text-slate-900 leading-snug">
                I specifically consent to using my recordings for AI model training and improvement.
              </span>
              <span className="block text-[11px] text-slate-500 font-normal leading-snug">
                I confirm that I have read and understood this form, had the opportunity to ask questions, and freely agree to the use of my voice recordings for the purposes described above.
              </span>
            </div>
          </button>
        </div>

        {/* Action Buttons: Accept & Decline */}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleDecline}
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition active:scale-[0.98] border border-slate-200 cursor-pointer"
          >
            Decline (Recording Disabled)
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading || !agreedToTerms}
            className="flex-1 min-h-[44px] rounded-xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white text-xs font-bold shadow-lg shadow-teal-600/25 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Recording Consent...' : 'Accept & Continue'}
          </button>
        </div>

        {/* Warning if declining / unchecked */}
        {!agreedToTerms && (
          <p className="text-[11px] text-slate-500 text-center mt-3">
            Note: Please check the box above to provide your consent and enable audio recording.
          </p>
        )}
      </div>
    </div>
  );
};
