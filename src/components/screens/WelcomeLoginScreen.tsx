import React, { useState } from 'react';
import {
  Mic,
  Lock,
  Mail,
  Smartphone,
  User as UserIcon,
  Calendar,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ShieldAlert,
} from 'lucide-react';
import { authService, RegisterParams, CURRENT_CONSENT_VERSION } from '../../services/authService';
import { User, Gender, Cohort, UserRole } from '../../types';

interface WelcomeLoginScreenProps {
  onLoginSuccess: (user: User) => void;
  onRegisterSuccess: (user: User) => void;
}

export const WelcomeLoginScreen: React.FC<WelcomeLoginScreenProps> = ({
  onLoginSuccess,
  onRegisterSuccess,
}) => {
  const [roleMode, setRoleMode] = useState<UserRole>('participant');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regCohort, setRegCohort] = useState<Cohort>('healthy');
  const [regGender, setRegGender] = useState<Gender>('prefer_not_to_say');
  const [regAge, setRegAge] = useState<string>('');
  const [regPassword, setRegPassword] = useState('');
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [showConsentDetails, setShowConsentDetails] = useState(false);

  // Forgot password form state
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');

  // Handle Login Submission (Email & Password)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanInput = loginIdentifier.trim();
    if (!cleanInput || !loginPassword) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const user = await authService.login(
        cleanInput,
        loginPassword,
        roleMode === 'admin' ? 'admin' : undefined
      );
      onLoginSuccess(user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Invalid credentials. Please verify your email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Direct Registration (Both Email & Mobile required, No OTP)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!regName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const cleanDigits = regMobile.replace(/\D/g, '').slice(-10);
    if (cleanDigits.length !== 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number (e.g. 9876543210).');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    const ageNum = regAge ? parseInt(regAge, 10) : undefined;
    if (ageNum !== undefined && (isNaN(ageNum) || ageNum < 18 || ageNum > 120)) {
      setErrorMessage('Please enter a valid adult age (18 or older) for research participation.');
      return;
    }

    if (!consentAgreed) {
      setErrorMessage('Please agree to the informed consent terms to create your account.');
      return;
    }

    setLoading(true);
    try {
      const params: RegisterParams = {
        name: regName.trim(),
        email: cleanEmail,
        mobileNumber: cleanDigits,
        cohort: regCohort,
        role: 'participant',
        gender: regGender,
        age: ageNum,
        password: regPassword,
        consentAgreed: true,
      };

      const user = await authService.register(params);
      onRegisterSuccess(user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Registration failed. Please check your details and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Password Recovery handler (via Email)
  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    if (recoveryNewPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(cleanEmail, recoveryNewPassword);
      setInfoMessage('Password has been successfully updated. You can now sign in.');
      setAuthMode('login');
      setLoginIdentifier(cleanEmail);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to reset password. Please check your email address.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-center px-4 py-8">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-400 shadow-xl shadow-teal-500/20 mb-3 text-white">
          <Mic className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
          Re<span className="text-teal-600 font-extrabold">Voice</span> Audio
        </h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto font-medium">
          Clinical Speech Corpus & Healthcare Acoustic Research
        </p>
      </div>

      {/* Primary Role Switcher: Participant vs Staff / Admin */}
      <div className="flex rounded-2xl bg-slate-200/80 p-1 mb-4 border border-slate-300/80">
        <button
          type="button"
          onClick={() => {
            setRoleMode('participant');
            setErrorMessage(null);
            setInfoMessage(null);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            roleMode === 'participant'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Participant Portal
        </button>

        <button
          type="button"
          onClick={() => {
            setRoleMode('admin');
            setAuthMode('login');
            setErrorMessage(null);
            setInfoMessage(null);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            roleMode === 'admin'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Staff / Admin Portal
        </button>
      </div>

      {/* Secondary Auth Switcher (Only for Participant: Login vs Register) */}
      {roleMode === 'participant' && (
        <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200/80 mb-5">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMessage(null);
              setInfoMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              authMode === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMessage(null);
              setInfoMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              authMode === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>
      )}

      {/* Staff Admin Notice */}
      {roleMode === 'admin' && (
        <div className="mb-4 p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-teal-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Authorized Clinical Staff Access</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Restricted to authorized ReVoice dataset administrators and investigators. Access attempts are audited.
          </p>
        </div>
      )}

      {/* Error / Info alerts */}
      {errorMessage && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 animate-fadeIn">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SIGN IN VIEW (Email & Password)                                        */}
      {/* ========================================================================= */}
      {(authMode === 'login' || roleMode === 'admin') && (
        <form onSubmit={handleLoginSubmit} className="space-y-4 rounded-3xl bg-white p-6 border border-slate-200/80 shadow-xl">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative flex items-center">
              <input
                type="email"
                required
                autoComplete="email"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder={roleMode === 'admin' ? 'Enter staff email' : 'name@example.com'}
                maxLength={80}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
              />
              <div className="absolute right-3.5 pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Enter your registered email address to sign in
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Password</label>
              {roleMode === 'participant' && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('forgot_password');
                    setErrorMessage(null);
                    setInfoMessage(null);
                  }}
                  className="text-[11px] text-teal-700 hover:text-teal-800 font-semibold"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 transition"
                aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
              >
                {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition disabled:opacity-50 mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying credentials...</span>
              </span>
            ) : (
              <>
                <span>{roleMode === 'admin' ? 'Authenticate Staff Access' : 'Sign In with Email'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* 2. SIGN UP: FILL DETAILS (EMAIL & PHONE NUMBER) - DIRECT REGISTRATION     */}
      {/* ========================================================================= */}
      {roleMode === 'participant' && authMode === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-3.5 rounded-3xl bg-white p-6 border border-slate-200/80 shadow-xl">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoComplete="name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Participant Name"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
              />
              <UserIcon className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Email Address Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
              />
              <Mail className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Phone Number Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Phone Number
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center gap-1 text-xs font-bold text-slate-600 pr-2 border-r border-slate-200 z-10 pointer-events-none">
                <span>🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                type="tel"
                required
                autoComplete="tel"
                value={regMobile}
                onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                maxLength={10}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 py-2.5 pl-20 pr-10 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
              />
              <Smartphone className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              10-digit mobile number for communication & identity
            </p>
          </div>

          {/* COHORT TRACK SELECTION */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Research Cohort Track
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRegCohort('healthy')}
                className={`p-2.5 rounded-xl border text-left text-xs font-medium transition ${
                  regCohort === 'healthy'
                    ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold ring-1 ring-teal-500'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Healthy Cohort</span>
                  {regCohort === 'healthy' && <CheckSquare className="w-3.5 h-3.5 text-teal-600" />}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 font-normal">Standard speech baseline</p>
              </button>

              <button
                type="button"
                onClick={() => setRegCohort('speech_impaired')}
                className={`p-2.5 rounded-xl border text-left text-xs font-medium transition ${
                  regCohort === 'speech_impaired'
                    ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold ring-1 ring-teal-500'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Speech-Impaired</span>
                  {regCohort === 'speech_impaired' && <CheckSquare className="w-3.5 h-3.5 text-teal-600" />}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 font-normal">Acoustic variance track</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Set Password
            </label>
            <div className="relative">
              <input
                type={showRegPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setShowRegPassword(!showRegPassword)}
                className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 transition"
                aria-label={showRegPassword ? 'Hide password' : 'Show password'}
              >
                {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Gender (optional)
              </label>
              <select
                value={regGender}
                onChange={(e) => setRegGender(e.target.value as Gender)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-500"
              >
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non_binary">Non-binary</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Age (optional)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={regAge}
                  onChange={(e) => setRegAge(e.target.value)}
                  placeholder="e.g. 26"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
                <Calendar className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* INFORMED CONSENT & PRIVACY AGREEMENT */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Audio Recording & Privacy Policy ({CURRENT_CONSENT_VERSION})
              </span>
              <button
                type="button"
                onClick={() => setShowConsentDetails(!showConsentDetails)}
                className="text-[11px] text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>{showConsentDetails ? 'Hide details' : 'Read full policy'}</span>
                {showConsentDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showConsentDetails && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-2 leading-relaxed max-h-56 overflow-y-auto">
                <p className="font-semibold text-slate-800">
                  I voluntarily agree to provide my voice recordings to <strong className="text-teal-900">ReVoice</strong> for developing and improving AI-based voice cloning and speech rehabilitation technology.
                </p>
                <p className="font-bold text-slate-700 pt-0.5">I understand that:</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>
                    <strong className="text-slate-700">Purpose:</strong> My recordings may be used to create, train, test, and improve voice-cloning models for speech generation.
                  </li>
                  <li>
                    <strong className="text-slate-700">Data Privacy:</strong> My recordings and related data will be stored securely and accessed only by authorised persons for the stated purposes.
                  </li>
                  <li>
                    <strong className="text-slate-700">Voluntary Participation:</strong> My participation is voluntary. I may withdraw my consent by using withdraw consent option on this website or through contacting on email:{' '}
                    <a href="mailto:revoicegenai@gmail.com" className="text-teal-700 underline font-semibold">revoicegenai@gmail.com</a>.
                  </li>
                  <li>
                    <strong className="text-slate-700">Data Deletion:</strong> I may request deletion of my recordings, subject to applicable law. However, removing recordings may not completely remove their influence from an already-trained AI model. My data will be deleted within 72 hours of my request, and I will receive confirmation of deletion.
                  </li>
                  <li>
                    <strong className="text-slate-700">Risks:</strong> I have been informed about the purpose and potential privacy risks.
                  </li>
                  <li>
                    <strong className="text-slate-700">Rights:</strong> I may contact{' '}
                    <a href="mailto:revoicegenai@gmail.com" className="text-teal-700 underline font-semibold">revoicegenai@gmail.com</a>{' '}
                    for questions, complaints, or requests regarding my data.
                  </li>
                </ol>
                <p className="pt-1 text-slate-500 italic">
                  I confirm that I have read and understood this form, had the opportunity to ask questions, and freely agree to the use of my voice recordings for the purposes described above.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setConsentAgreed(!consentAgreed)}
              className="flex items-start gap-2.5 text-left group w-full cursor-pointer pt-0.5 select-none"
            >
              <div className="mt-0.5 text-teal-600 group-hover:text-teal-700 shrink-0">
                {consentAgreed ? (
                  <CheckSquare className="w-4 h-4 fill-teal-600 text-white" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                )}
              </div>
              <div className="text-xs space-y-0.5">
                <span className="block font-bold text-slate-900 leading-snug">
                  I specifically consent to using my recordings for AI model training and improvement.
                </span>
                <span className="block text-[11px] text-slate-500 leading-snug">
                  I confirm that I have read, understood, and agree to the Audio Recording & Privacy Policy.
                </span>
              </div>
            </button>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !consentAgreed}
              className="w-full min-h-[46px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 active:scale-[0.98] transition disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </span>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* 3. PASSWORD RECOVERY VIEW (VIA EMAIL)                                     */}
      {/* ========================================================================= */}
      {authMode === 'forgot_password' && (
        <form onSubmit={handlePasswordRecovery} className="space-y-4 rounded-3xl bg-white p-6 border border-slate-200/80 shadow-xl">
          <div className="text-left">
            <h2 className="text-sm font-bold text-slate-900">Reset Password</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your registered email address and choose a new password.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Registered Email Address</label>
            <div className="relative flex items-center">
              <input
                type="email"
                required
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white"
              />
              <Mail className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              required
              value={recoveryNewPassword}
              onChange={(e) => setRecoveryNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition border border-slate-200"
            >
              Back to Sign in
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
