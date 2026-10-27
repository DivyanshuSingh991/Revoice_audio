import React from 'react';
import { ArrowLeft, Activity, LayoutDashboard, AudioLines, CheckSquare, Trash2, Shield, Settings, HardDrive } from 'lucide-react';
import { User, ActiveScreen } from '../../types';

interface TopAppBarProps {
  user: User | null;
  activeScreen: ActiveScreen;
  onNavigateBack: () => void;
  onOpenProfile: () => void;
  onNavigate?: (screen: ActiveScreen) => void;
  savedRecordingsCount?: number;
  pendingReviewsCount?: number;
  pendingDeletionsCount?: number;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  user,
  activeScreen,
  onNavigateBack,
  onOpenProfile,
  onNavigate,
  savedRecordingsCount = 0,
  pendingReviewsCount = 0,
  pendingDeletionsCount = 0,
}) => {
  const isSubScreen =
    activeScreen === 'sentence_list' ||
    activeScreen === 'consent';

  const participantNav = [
    { id: 'home' as ActiveScreen, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my_recordings' as ActiveScreen, label: 'My Audio', icon: AudioLines, badge: savedRecordingsCount },
    { id: 'profile_settings' as ActiveScreen, label: 'Profile & Settings', icon: Settings },
  ];

  const adminNav = [
    { id: 'admin_dashboard' as ActiveScreen, label: 'Overview', icon: LayoutDashboard },
    { id: 'admin_reviews' as ActiveScreen, label: 'Review Queue', icon: CheckSquare, badge: pendingReviewsCount },
    { id: 'admin_deletions' as ActiveScreen, label: 'Deletions', icon: Trash2, badge: pendingDeletionsCount },
    { id: 'admin_profile' as ActiveScreen, label: 'Admin Security', icon: Shield },
  ];

  const navLinks = user?.role === 'admin' ? adminNav : participantNav;

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-8 h-16 flex items-center justify-between gap-4 shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
      {/* Left Slot: Wordmark & Brand */}
      <div className="flex items-center gap-3">
        {isSubScreen ? (
          <button
            type="button"
            onClick={onNavigateBack}
            className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-teal-50/80 transition active:scale-95 border border-slate-200"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
        )}

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-slate-900 font-sans">
              Re<span className="text-teal-600 font-extrabold">Voice</span>
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Web Portal
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium -mt-0.5">
            Clinical Speech Research Platform
          </span>
        </div>
      </div>

      {/* Center: Desktop Navigation Tabs (Web Browser View) */}
      {user && onNavigate && (
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">
          {navLinks.map((item) => {
            const isActive = activeScreen === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition relative ${
                  isActive
                    ? 'bg-white text-teal-700 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-teal-600 text-white' : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* Right Slot: Storage Indicator & User Profile Pill */}
      <div className="flex items-center gap-2.5">
        {/* System Storage Indicator Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-mono" title="Audios stored in local system paths; DB retains metadata only. Ready for future Google Cloud Storage migration.">
          <HardDrive className="w-3.5 h-3.5 text-teal-600" />
          <span>System Disk Storage</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>

        {user && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-teal-50/80 border border-slate-200/80 hover:border-teal-200 transition active:scale-95 shadow-xs group"
            title={`${user.name} (${user.mobileNumber || user.email})`}
          >
            <div
              className={`w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center shadow-xs ${
                user.role === 'admin'
                  ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 ring-1 ring-indigo-400'
                  : 'bg-gradient-to-tr from-teal-600 to-emerald-500'
              }`}
            >
              {user.name
                .split(' ')
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col items-start text-left hidden sm:flex">
              <span className="text-xs font-bold text-slate-800 max-w-[120px] truncate leading-tight">
                {user.name.split(' ')[0]}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight">
                {user.role === 'admin' ? 'Staff Admin' : user.participantId}
              </span>
            </div>
          </button>
        )}
      </div>
    </header>
  );
};
