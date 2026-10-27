import React from 'react';
import { LayoutDashboard, AudioLines, Settings, CheckSquare, Trash2, Shield } from 'lucide-react';
import { ActiveScreen, UserRole } from '../../types';

interface BottomNavBarProps {
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  savedRecordingsCount: number;
  role?: UserRole;
  pendingReviewsCount?: number;
  pendingDeletionsCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeScreen,
  onNavigate,
  savedRecordingsCount,
  role = 'participant',
  pendingReviewsCount = 0,
  pendingDeletionsCount = 0,
}) => {
  // Participant: EXACTLY 3 MAIN TABS (Dashboard, My Audio, Profile)
  const participantTabs = [
    {
      id: 'home' as ActiveScreen,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'my_recordings' as ActiveScreen,
      label: 'My Audio',
      icon: AudioLines,
      badge: savedRecordingsCount > 0 ? savedRecordingsCount : undefined,
    },
    {
      id: 'profile_settings' as ActiveScreen,
      label: 'Profile',
      icon: Settings,
    },
  ];

  // Admin Tabs: Dashboard, Review Queue, Deletions, and Admin Profile
  const adminTabs = [
    {
      id: 'admin_dashboard' as ActiveScreen,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'admin_reviews' as ActiveScreen,
      label: 'Review Queue',
      icon: CheckSquare,
      badge: pendingReviewsCount > 0 ? pendingReviewsCount : undefined,
    },
    {
      id: 'admin_deletions' as ActiveScreen,
      label: 'Deletions',
      icon: Trash2,
      badge: pendingDeletionsCount > 0 ? pendingDeletionsCount : undefined,
    },
    {
      id: 'admin_profile' as ActiveScreen,
      label: 'Profile',
      icon: Shield,
    },
  ];

  const tabs = role === 'admin' ? adminTabs : participantTabs;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-teal-100/80 px-2 h-16 max-w-lg mx-auto sm:max-w-xl shadow-[0_-4px_25px_rgba(15,118,110,0.06)]">
      <div className={`grid ${role === 'admin' ? 'grid-cols-4' : 'grid-cols-3'} h-full items-center`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeScreen === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition active:scale-95 relative ${
                isActive ? 'text-teal-600 font-bold' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-teal-600 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 leading-none tracking-tight font-medium">
                {tab.label}
              </span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1 shadow-xs shadow-teal-500/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
