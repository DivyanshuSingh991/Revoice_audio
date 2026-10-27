import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity } from 'lucide-react';
import {
  User,
  ConsentRecord,
  Sentence,
  Recording,
  ActiveScreen,
  ReviewAudioData,
  SentenceLevel,
  ToastMessage,
  ParticipantProgress,
  DeletionRequest,
  AuditLog,
} from './types';
import { authService } from './services/authService';
import { dbService } from './services/db';
import { recordingRepository, UserStats } from './services/recordingRepository';
import { audioStorageService, StorageStats } from './services/audioStorageService';
import { progressService } from './services/progressService';
import { deletionService } from './services/deletionService';

// Layout & UI Components
import { TopAppBar } from './components/layout/TopAppBar';
import { BottomNavBar } from './components/layout/BottomNavBar';
import { Toast } from './components/Toast';

// Participant Screens & Modals
import { WelcomeLoginScreen } from './components/screens/WelcomeLoginScreen';
import { RegistrationSuccessModal } from './components/screens/RegistrationSuccessModal';
import { ConsentScreen } from './components/screens/ConsentScreen';
import { HomeDashboardScreen } from './components/screens/HomeDashboardScreen';
import { SentenceListScreen } from './components/screens/SentenceListScreen';
import { RecordingModal } from './components/screens/RecordingModal';
import { ReviewModal } from './components/screens/ReviewModal';
import { MyRecordingsScreen } from './components/screens/MyRecordingsScreen';
import { RecordingDetailsModal } from './components/screens/RecordingDetailsModal';
import { ProfileSettingsScreen } from './components/screens/ProfileSettingsScreen';

// Admin Screens
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminReviewQueue } from './components/admin/AdminReviewQueue';
import { AdminDeletionsScreen } from './components/admin/AdminDeletionsScreen';
import { AdminProfileScreen } from './components/admin/AdminProfileScreen';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentConsent, setCurrentConsent] = useState<ConsentRecord | null>(null);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('welcome');
  const [screenHistory, setScreenHistory] = useState<ActiveScreen[]>(['welcome']);

  // Corpus data
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats>({ fileCount: 0, totalBytes: 0 });

  // Participant Progress & Deletion Requests
  const [participantProgress, setParticipantProgress] = useState<ParticipantProgress | null>(null);
  const [participantDeletionRequests, setParticipantDeletionRequests] = useState<DeletionRequest[]>([]);

  // Admin Data Store
  const [allParticipants, setAllParticipants] = useState<User[]>([]);
  const [allAdminRecordings, setAllAdminRecordings] = useState<Recording[]>([]);
  const [allDeletionRequests, setAllDeletionRequests] = useState<DeletionRequest[]>([]);
  const [allAuditLogs, setAllAuditLogs] = useState<AuditLog[]>([]);
  const [exportingVerifiedDataset, setExportingVerifiedDataset] = useState(false);

  // Modal overlays
  const [activeRecordingSentence, setActiveRecordingSentence] = useState<Sentence | null>(null);
  const [activeReviewData, setActiveReviewData] = useState<ReviewAudioData | null>(null);
  const [selectedDetailsRecording, setSelectedDetailsRecording] = useState<Recording | null>(null);
  const [selectedSentenceLevelFilter, setSelectedSentenceLevelFilter] = useState<SentenceLevel | 'all'>('all');

  // Status feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [exportingCorpus, setExportingCorpus] = useState(false);
  const [appInitializing, setAppInitializing] = useState(true);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Map sentences for O(1) lookup
  const sentencesMap = useMemo(() => {
    const map = new Map<string, Sentence>();
    for (const s of sentences) {
      map.set(s.id, s);
    }
    return map;
  }, [sentences]);

  // Compute live user stats for participant
  const userStats: UserStats = useMemo(() => {
    return recordingRepository.calculateStats(recordings, sentences);
  }, [recordings, sentences]);

  const hasValidConsent = useMemo(() => {
    return currentConsent !== null && currentConsent.consentStatus === 'accepted';
  }, [currentConsent]);

  // Compute assigned sentences for each difficulty level
  const assignedSentences = useMemo((): Record<SentenceLevel, Sentence | null> => {
    if (!participantProgress || sentences.length === 0) {
      return { 1: null, 2: null, 3: null };
    }
    return {
      1: progressService.getAssignedSentenceForLevel(participantProgress, 1, sentences),
      2: progressService.getAssignedSentenceForLevel(participantProgress, 2, sentences),
      3: progressService.getAssignedSentenceForLevel(participantProgress, 3, sentences),
    };
  }, [participantProgress, sentences]);

  // Pending deletion recording IDs for participant
  const pendingDeletionRecIds = useMemo(() => {
    const set = new Set<string>();
    for (const req of participantDeletionRequests) {
      if (req.targetRecordingId && req.status !== 'Completed') {
        set.add(req.targetRecordingId);
      }
    }
    return set;
  }, [participantDeletionRequests]);

  // Load participant data
  const refreshUserData = useCallback(async (userId: string) => {
    try {
      const [recs, stats, reqs] = await Promise.all([
        recordingRepository.getRecordings(userId),
        audioStorageService.getStorageStats(),
        deletionService.getRequests(userId),
      ]);
      setRecordings(recs);
      setStorageStats(stats);
      setParticipantDeletionRequests(reqs);
    } catch (e) {
      console.error('Error refreshing participant data:', e);
    }
  }, []);

  // Load admin data
  const refreshAdminData = useCallback(async () => {
    try {
      const [users, allRecs, reqs, logs] = await Promise.all([
        dbService.getAllParticipants(),
        recordingRepository.getAllRecordings(),
        deletionService.getRequests(),
        dbService.getAuditLogs(),
      ]);
      setAllParticipants(users);
      setAllAdminRecordings(allRecs);
      setAllDeletionRequests(reqs);
      setAllAuditLogs(logs);
    } catch (e) {
      console.error('Error refreshing admin data:', e);
    }
  }, []);

  // Initial App Startup
  useEffect(() => {
    async function initApp() {
      try {
        // 1. Fetch corpus sentences
        const allSentences = await dbService.getAllSentences();
        setSentences(allSentences);

        // 2. Check active session
        const sessionUser = await authService.initSession();
        if (sessionUser) {
          setCurrentUser(sessionUser);

          if (sessionUser.role === 'admin') {
            await refreshAdminData();
            setActiveScreen('admin_dashboard');
            setScreenHistory(['admin_dashboard']);
          } else {
            // Participant
            const consent = authService.getCurrentConsent();
            setCurrentConsent(consent);
            await refreshUserData(sessionUser.id);
            const prog = await progressService.getOrCreateProgress(sessionUser);
            setParticipantProgress(prog);

            if (consent && consent.consentStatus === 'accepted') {
              setActiveScreen('home');
              setScreenHistory(['home']);
            } else {
              setActiveScreen('consent');
              setScreenHistory(['home', 'consent']);
            }
          }
        } else {
          setActiveScreen('welcome');
          setScreenHistory(['welcome']);
        }
      } catch (err) {
        console.error('App init failed:', err);
      } finally {
        setAppInitializing(false);
      }
    }

    initApp();
  }, [refreshUserData, refreshAdminData]);

  // Browser back-button popstate listener
  useEffect(() => {
    const handlePopState = () => {
      if (activeReviewData) {
        setActiveReviewData(null);
        return;
      }
      if (activeRecordingSentence) {
        setActiveRecordingSentence(null);
        return;
      }
      if (selectedDetailsRecording) {
        setSelectedDetailsRecording(null);
        return;
      }

      setScreenHistory((prev) => {
        if (prev.length > 1) {
          const next = [...prev];
          next.pop();
          const target = next[next.length - 1];
          setActiveScreen(target);
          return next;
        }
        return prev;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeReviewData, activeRecordingSentence, selectedDetailsRecording]);

  // Navigation push helper
  const navigateTo = useCallback((screen: ActiveScreen) => {
    window.history.pushState({ screen }, '');
    setActiveScreen(screen);
    setScreenHistory((prev) => [...prev, screen]);
  }, []);

  // Top Bar Back navigation
  const handleTopBarBack = useCallback(() => {
    if (currentUser?.role === 'admin') {
      navigateTo('admin_dashboard');
      return;
    }

    if (
      activeScreen === 'sentence_list' ||
      activeScreen === 'my_recordings' ||
      activeScreen === 'profile_settings' ||
      activeScreen === 'consent'
    ) {
      navigateTo('home');
    } else {
      window.history.back();
    }
  }, [currentUser, activeScreen, navigateTo]);

  // Authentication Handlers
  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);

    if (user.role === 'admin') {
      await refreshAdminData();
      addToast('success', `Authenticated as Staff Admin (${user.name}). Access authorized.`);
      navigateTo('admin_dashboard');
    } else {
      const consent = authService.getCurrentConsent();
      setCurrentConsent(consent);
      await refreshUserData(user.id);
      const prog = await progressService.getOrCreateProgress(user);
      setParticipantProgress(prog);

      addToast('success', `Welcome back, ${user.name}!`);

      if (consent && consent.consentStatus === 'accepted') {
        navigateTo('home');
      } else {
        navigateTo('consent');
      }
    }
  };

  const handleRegisterSuccess = async (user: User) => {
    setCurrentUser(user);
    const consent = authService.getCurrentConsent();
    setCurrentConsent(consent);
    await refreshUserData(user.id);
    const prog = await progressService.getOrCreateProgress(user);
    setParticipantProgress(prog);

    addToast('success', `Welcome to ReVoice, ${user.name}! Permanent ID generated.`);
    navigateTo('home');
  };

  const handleProceedToConsentFromSuccess = () => {
    navigateTo('home');
  };

  const handleConsentComplete = (accepted: boolean) => {
    const updated = authService.getCurrentConsent();
    setCurrentConsent(updated);

    if (accepted) {
      addToast('success', 'Informed consent accepted. All 3 difficulty level tracks are now active.');
      navigateTo('home');
    } else {
      addToast('error', 'Consent was declined. Audio recording features are locked.');
      navigateTo('home');
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentConsent(null);
    setParticipantProgress(null);
    setRecordings([]);
    setAllParticipants([]);
    setAllAdminRecordings([]);
    setActiveScreen('welcome');
    setScreenHistory(['welcome']);
    addToast('info', 'You have been safely signed out.');
  };

  const handlePurgeAccount = async () => {
    if (!currentUser) return;
    try {
      await authService.withdrawConsentAndPurge();
      setCurrentUser(null);
      setCurrentConsent(null);
      setParticipantProgress(null);
      setRecordings([]);
      setActiveScreen('welcome');
      setScreenHistory(['welcome']);
      addToast('success', 'Participant consent withdrawn and local voice data purged.');
    } catch {
      addToast('error', 'Failed to purge data.');
    }
  };

  // Recording Workflows
  const handleStartSentenceRecording = (sentence: Sentence) => {
    if (!hasValidConsent) {
      addToast('error', 'Informed consent is required before recording speech.');
      navigateTo('consent');
      return;
    }
    setActiveRecordingSentence(sentence);
  };

  const handleRecordingFinished = (reviewData: ReviewAudioData) => {
    setActiveRecordingSentence(null);
    setActiveReviewData(reviewData);
  };

  // Save submitted recording take
  const handleSaveRecording = async (reviewData: ReviewAudioData) => {
    if (!currentUser) throw new Error('Not authenticated.');

    // 1. Save through repository (converts to 16kHz 16-bit PCM WAV, saves to private path)
    const newRec = await recordingRepository.saveRecording(
      currentUser.id,
      currentUser.participantId,
      reviewData.sentence,
      reviewData.tempBlob,
      currentUser.cohort
    );

    // 2. Advance prompt sequence independently for this difficulty level
    const updatedProg = await progressService.advanceLevelSequence(
      currentUser.id,
      reviewData.sentence.level,
      reviewData.sentence.promptId || reviewData.sentence.id,
      sentences
    );
    setParticipantProgress(updatedProg);

    // 3. Refresh user state
    await refreshUserData(currentUser.id);

    addToast(
      'success',
      `Prompt take submitted (${(newRec.fileSize / 1024).toFixed(0)} KB WAV). Next sentence in level unlocked.`
    );

    setTimeout(() => {
      setActiveReviewData(null);
    }, 1200);
  };

  // Retake: Keeps the exact same sentence without advancing sequence; attempt count increments on next save
  const handleRetakeFromReview = () => {
    if (!activeReviewData) return;
    const sent = activeReviewData.sentence;
    setActiveReviewData(null);
    setActiveRecordingSentence(sent);
  };

  const handleDiscardFromReview = () => {
    setActiveReviewData(null);
    addToast('info', 'Recording take discarded.');
  };

  // Request Deletion Workflow (Participants submit requests to Admin after submission)
  const handleRequestRecordingDeletion = async (rec: Recording, reason?: string) => {
    if (!currentUser) return;
    try {
      await deletionService.submitRecordingDeletionRequest(currentUser, rec, reason);
      const reqs = await deletionService.getRequests(currentUser.id);
      setParticipantDeletionRequests(reqs);
      addToast(
        'success',
        'Your deletion request has been submitted to the Administrator for review.'
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to submit deletion request.';
      addToast('error', msg);
    }
  };

  // Participant Export ZIP
  const handleExportCorpus = async () => {
    if (!currentUser || recordings.length === 0) {
      addToast('error', 'No recordings available to export.');
      return;
    }

    setExportingCorpus(true);
    try {
      const zipBlob = await audioStorageService.exportCorpusZip(
        currentUser,
        recordings,
        sentencesMap
      );

      const filename = `${currentUser.participantId}_speech_corpus_${new Date().toISOString().slice(0, 10)}.zip`;
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      addToast('success', `Corpus package downloaded (${(zipBlob.size / 1024).toFixed(0)} KB ZIP).`);
    } catch (e: unknown) {
      console.error(e);
      addToast('error', 'Failed to generate corpus ZIP package.');
    } finally {
      setExportingCorpus(false);
    }
  };

  // Target per level update (configurable targets e.g. 1 per level = 3 total)
  const handleUpdateTargetPerLevel = async (target: number) => {
    if (!currentUser) return;
    try {
      const updated = await progressService.updateTargetPerLevel(currentUser.id, target);
      setParticipantProgress(updated);
      addToast('info', `Target set to ${target} sentence(s) per level (${target * 3} total).`);
    } catch {
      addToast('error', 'Failed to update target count.');
    }
  };

  // Admin Review Submission Callback
  const handleAdminReviewSubmitted = async (updatedRecording: Recording) => {
    setAllAdminRecordings((prev) =>
      prev.map((r) => (r.id === updatedRecording.id ? updatedRecording : r))
    );
    const logs = await dbService.getAuditLogs();
    setAllAuditLogs(logs);
    addToast(
      'success',
      `Review saved for ${updatedRecording.id}: Status is now ${updatedRecording.reviewStatus.toUpperCase()}.`
    );
  };

  // Admin Verified Dataset Export (only approved recordings with verified active consent)
  const handleAdminExportVerifiedDataset = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      addToast('error', 'Administrator role required.');
      return;
    }

    const approvedTakes = allAdminRecordings.filter((r) => r.reviewStatus === 'approved');
    if (approvedTakes.length === 0) {
      addToast('error', 'No approved recordings are available to export. Review recordings first.');
      return;
    }

    setExportingVerifiedDataset(true);
    try {
      const { blob, exportedCount } = await audioStorageService.exportVerifiedAdminDataset(
        currentUser,
        approvedTakes,
        sentencesMap,
        allParticipants
      );

      const filename = `ReVoice_Verified_Corpus_${new Date().toISOString().slice(0, 10)}.zip`;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      // Audit log
      await dbService.addAuditLog({
        id: crypto.randomUUID(),
        action: 'DATASET_EXPORTED',
        performedBy: currentUser.email,
        details: `Exported verified speech corpus containing ${exportedCount} clinically approved takes (${(blob.size / 1024).toFixed(0)} KB ZIP).`,
        timestamp: Date.now(),
      });

      const updatedLogs = await dbService.getAuditLogs();
      setAllAuditLogs(updatedLogs);

      addToast(
        'success',
        `Verified research dataset exported (${exportedCount} approved takes, ${(blob.size / 1024).toFixed(0)} KB ZIP).`
      );
    } catch (e) {
      console.error(e);
      addToast('error', 'Failed to export verified dataset.');
    } finally {
      setExportingVerifiedDataset(false);
    }
  };

  if (appInitializing) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-400 flex items-center justify-center text-white mx-auto shadow-lg shadow-teal-500/20 animate-pulse">
            <Activity className="w-7 h-7 stroke-[2.5]" />
          </div>
          <p className="text-xs text-teal-800 font-bold">Initializing ReVoice Audio Corpus Database...</p>
        </div>
      </div>
    );
  }

  // Pending counts for Admin Badges
  const pendingReviewsCount = allAdminRecordings.filter((r) => r.reviewStatus === 'pending').length;
  const pendingDeletionsCount = allDeletionRequests.filter(
    (r) => r.status === 'Submitted' || r.status === 'Under Review' || r.status === 'Processing'
  ).length;

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Top App Bar (shown when logged in) */}
      {currentUser && (
        <TopAppBar
          user={currentUser}
          activeScreen={activeScreen}
          onNavigateBack={handleTopBarBack}
          onOpenProfile={() => {
            if (currentUser.role === 'admin') {
              navigateTo('admin_profile');
            } else {
              navigateTo('profile_settings');
            }
          }}
          onNavigate={navigateTo}
          savedRecordingsCount={recordings.length}
          pendingReviewsCount={pendingReviewsCount}
          pendingDeletionsCount={pendingDeletionsCount}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col">
        {/* SCREEN 1: Welcome & Login */}
        {activeScreen === 'welcome' && (
          <WelcomeLoginScreen
            onLoginSuccess={handleLoginSuccess}
            onRegisterSuccess={handleRegisterSuccess}
          />
        )}

        {/* SCREEN 2: Registration Success & Permanent ID Reveal */}
        {activeScreen === 'registration_success' && currentUser && (
          <RegistrationSuccessModal
            user={currentUser}
            onProceedToConsent={handleProceedToConsentFromSuccess}
          />
        )}

        {/* SCREEN 3: Informed Consent & Ethics */}
        {activeScreen === 'consent' && currentUser && (
          <ConsentScreen
            user={currentUser}
            existingConsent={currentConsent}
            onConsentComplete={handleConsentComplete}
          />
        )}

        {/* ======================================================== */}
        {/* PARTICIPANT TAB 1: Dashboard & Sequential Recording */}
        {/* ======================================================== */}
        {activeScreen === 'home' && currentUser && currentUser.role === 'participant' && (
          <HomeDashboardScreen
            user={currentUser}
            hasConsent={hasValidConsent}
            stats={userStats}
            allSentences={sentences}
            progress={participantProgress}
            assignedSentences={assignedSentences}
            onRecordSentence={handleStartSentenceRecording}
            onOpenMyRecordings={() => navigateTo('my_recordings')}
            onOpenConsent={() => navigateTo('consent')}
            onUpdateTargetPerLevel={handleUpdateTargetPerLevel}
            recordings={recordings}
          />
        )}

        {/* PARTICIPANT Sentence List (Secondary inspection view) */}
        {activeScreen === 'sentence_list' && currentUser && currentUser.role === 'participant' && (
          <SentenceListScreen
            initialLevel={selectedSentenceLevelFilter}
            sentences={sentences}
            recordings={recordings}
            hasConsent={hasValidConsent}
            onRecordSentence={handleStartSentenceRecording}
            onPlayRecording={(rec) => setSelectedDetailsRecording(rec)}
            onBackToDashboard={() => navigateTo('home')}
            onOpenConsentRequired={() => {
              addToast('error', 'Informed consent is required before recording audio.');
              navigateTo('consent');
            }}
          />
        )}

        {/* ======================================================== */}
        {/* PARTICIPANT TAB 2: My Audio (Audition & Purpose Status) */}
        {/* ======================================================== */}
        {activeScreen === 'my_recordings' && currentUser && (
          <MyRecordingsScreen
            user={currentUser}
            recordings={recordings}
            sentencesMap={sentencesMap}
            onOpenDetails={(rec) => setSelectedDetailsRecording(rec)}
            onRequestDelete={(rec) => setSelectedDetailsRecording(rec)}
            onRetakeRecording={handleStartSentenceRecording}
            onBackToDashboard={() => navigateTo('home')}
            onExportCorpus={handleExportCorpus}
            exporting={exportingCorpus}
            pendingDeletionRecIds={pendingDeletionRecIds}
          />
        )}

        {/* ======================================================== */}
        {/* PARTICIPANT TAB 3: Profile & Withdrawal Requests */}
        {/* ======================================================== */}
        {activeScreen === 'profile_settings' && currentUser && (
          <ProfileSettingsScreen
            user={currentUser}
            consent={currentConsent}
            storageStats={storageStats}
            recordingsCount={recordings.length}
            onLogout={handleLogout}
            onOpenConsentDoc={() => navigateTo('consent')}
            onPurgeAccount={handlePurgeAccount}
            onExportCorpus={handleExportCorpus}
          />
        )}

        {/* ======================================================== */}
        {/* ADMIN TAB 1: Dashboard & Quality Metrics */}
        {/* ======================================================== */}
        {activeScreen === 'admin_dashboard' && currentUser && currentUser.role === 'admin' && (
          <AdminDashboard
            adminUser={currentUser}
            allUsers={allParticipants}
            allRecordings={allAdminRecordings}
            sentencesMap={sentencesMap}
            deletionRequests={allDeletionRequests}
            auditLogs={allAuditLogs}
            onOpenReviews={() => navigateTo('admin_reviews')}
            onOpenDeletions={() => navigateTo('admin_deletions')}
            onOpenProfile={() => navigateTo('admin_profile')}
            onExportVerifiedDataset={handleAdminExportVerifiedDataset}
            exportingDataset={exportingVerifiedDataset}
          />
        )}

        {/* ======================================================== */}
        {/* ADMIN TAB 2: Dedicated Review & Clinical Approval Queue */}
        {/* ======================================================== */}
        {activeScreen === 'admin_reviews' && currentUser && currentUser.role === 'admin' && (
          <AdminReviewQueue
            adminUser={currentUser}
            recordings={allAdminRecordings}
            sentencesMap={sentencesMap}
            onReviewSubmitted={handleAdminReviewSubmitted}
          />
        )}

        {/* ======================================================== */}
        {/* ADMIN TAB 3: Withdrawal & Deletion Requests Ledger */}
        {/* ======================================================== */}
        {activeScreen === 'admin_deletions' && currentUser && currentUser.role === 'admin' && (
          <AdminDeletionsScreen
            adminUser={currentUser}
            requests={allDeletionRequests}
            onRequestsUpdated={refreshAdminData}
          />
        )}

        {/* ======================================================== */}
        {/* ADMIN TAB 4: Administrator Profile & Ethics Undertaking */}
        {/* ======================================================== */}
        {activeScreen === 'admin_profile' && currentUser && currentUser.role === 'admin' && (
          <AdminProfileScreen
            adminUser={currentUser}
            onLogout={handleLogout}
            onBackToDashboard={() => navigateTo('admin_dashboard')}
            totalRecordingsCount={allAdminRecordings.length}
            totalParticipantsCount={allParticipants.length}
          />
        )}
      </main>

      {/* OVERLAY MODAL: Active Recording Session */}
      {activeRecordingSentence && (
        <RecordingModal
          sentence={activeRecordingSentence}
          onRecordingComplete={handleRecordingFinished}
          onClose={() => setActiveRecordingSentence(null)}
        />
      )}

      {/* OVERLAY MODAL: Review & Verification */}
      {activeReviewData && (
        <ReviewModal
          reviewData={activeReviewData}
          onSubmit={handleSaveRecording}
          onRetake={handleRetakeFromReview}
          onDiscard={handleDiscardFromReview}
        />
      )}

      {/* OVERLAY MODAL: Recording Details & Request Deletion */}
      {selectedDetailsRecording && currentUser && (
        <RecordingDetailsModal
          recording={selectedDetailsRecording}
          sentence={sentencesMap.get(selectedDetailsRecording.sentenceId)}
          user={currentUser}
          onRequestDeletion={handleRequestRecordingDeletion}
          onRetake={handleStartSentenceRecording}
          onClose={() => setSelectedDetailsRecording(null)}
          isDeletionPending={pendingDeletionRecIds.has(selectedDetailsRecording.recordingId || selectedDetailsRecording.id)}
        />
      )}



      {/* Bottom Navigation Bar */}
      {currentUser && activeScreen !== 'welcome' && activeScreen !== 'registration_success' && (
        <BottomNavBar
          activeScreen={activeScreen}
          onNavigate={(screen) => navigateTo(screen)}
          savedRecordingsCount={recordings.length}
          role={currentUser.role}
          pendingReviewsCount={pendingReviewsCount}
          pendingDeletionsCount={pendingDeletionsCount}
        />
      )}
    </div>
  );
}
