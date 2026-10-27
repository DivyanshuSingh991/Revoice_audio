import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { User } from '../../types';

interface RegistrationSuccessModalProps {
  user: User;
  onProceedToConsent: () => void;
}

export const RegistrationSuccessModal: React.FC<RegistrationSuccessModalProps> = ({
  user,
  onProceedToConsent,
}) => {
  useEffect(() => {
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#0d9488', '#10b981', '#38bdf8'],
      });
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-center px-4 py-8">
      <div className="rounded-3xl bg-white p-7 border border-slate-200/80 shadow-2xl text-center space-y-5">
        {/* Success Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900">Account Created!</h2>
          <p className="text-xs text-slate-500 mt-1">
            Welcome to ReVoice Audio, <strong className="text-slate-800">{user.name}</strong>. Your voice workspace is ready.
          </p>
        </div>

        {/* Workspace summary */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left text-xs space-y-2">
          <div className="flex items-center gap-2 text-teal-800 font-semibold">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span>Workspace Ready</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            You can now explore prompt collections, record studio-grade 16kHz audio samples, and track your speech corpus progress.
          </p>
          <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Secure local storage on this device</span>
          </div>
        </div>

        {/* Proceed Action */}
        <button
          type="button"
          onClick={onProceedToConsent}
          className="w-full min-h-[46px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition"
        >
          <span>Open Recording Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
