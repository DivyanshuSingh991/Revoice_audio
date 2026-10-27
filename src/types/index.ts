/**
 * ReVoice Audio Core Types & Schemas
 * Standardized for speech corpus collection, participant identity, clinical review, and local storage.
 */

export type Gender = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

export type UserRole = 'participant' | 'admin';

export type Cohort = 'healthy' | 'speech_impaired';

export interface User {
  id: string; // UUID primary key
  participantId: string; // Readable sequential ID: SPK_0001, SPK_0002 or STAFF_0001
  name: string;
  email: string;
  mobileNumber?: string; // 10-digit mobile number for phone authentication
  role: UserRole;
  cohort: Cohort;
  gender: Gender;
  age?: number;
  passwordHash: string; // PBKDF2-SHA256 hex string
  passwordSalt: string; // Cryptographic salt hex string
  createdAt: number; // Unix timestamp ms
  status: 'active' | 'withdrawn';
}

export type ConsentStatus = 'accepted' | 'declined' | 'withdrawn';

export interface ConsentRecord {
  id: string; // UUID
  userId: string;
  consentVersion: string; // e.g. "v1.2-2026"
  consentStatus: ConsentStatus;
  agreedTerms: string[];
  timestamp: number; // Unix timestamp ms
}

export type SentenceLevel = 1 | 2 | 3;

export interface Sentence {
  id: string; // e.g. "L1_S01"
  promptId: string; // e.g. "L1_S01" (canonical speech corpus prompt ID)
  level: SentenceLevel;
  sentenceNumber: number; // 1-based index within level
  text: string; // Hindi Devanagari prompt
  instructionNotes?: string; // Hinglish pronunciation / transliteration
  category?: string; // e.g. "Phoneme repetiton", "Sen max alphabet", "Sentence"
  difficultyLevel?: string; // e.g. "Level 1 (Easy)"
  active: boolean;
}

export type StorageStatus = 'saved_local' | 'pending_upload' | 'uploaded';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'retake_required';

export type DataUseStatus = 'approved' | 'actually_used' | 'not_used' | 'unknown';

export interface ReviewChecklist {
  idConsistency: boolean;
  fileIntegrity: boolean;
  completeness: boolean;
  clarity: boolean;
  lowNoise: boolean;
  metadataAccurate: boolean;
}

export interface ReviewRecord {
  id: string;
  recordingId: string;
  reviewerId: string;
  reviewerEmail?: string;
  decision: ReviewStatus;
  reason?: string;
  checklist: ReviewChecklist;
  timestamp: number;
}

export interface Recording {
  id: string; // Canonical Recording ID: REC_<speakerId>_<promptId> (e.g. REC_SPK0001_L1S01)
  recordingId: string; // Explicit recording_id (e.g. REC_SPK0001_L1S01)
  userId: string; // User account primary key
  speakerId: string; // Explicit speaker_id (e.g. SPK_0001, SIM_0001)
  participantId: string; // Synonymous with speakerId
  sentenceId: string; // Foreign key matching Sentence.id
  promptId: string; // Canonical speech corpus prompt ID (e.g. "L1_S01")
  level: SentenceLevel;
  cohort: Cohort;
  localFilePath: string; // Predictable path: recordings/{speakerId}/level_{level}/{recordingId}.wav
  audioFormat: 'audio/wav';
  sampleRate: number; // e.g. 16000 or 44100 Hz
  bitDepth: number; // 16-bit Linear PCM
  channelCount: number; // 1 (mono)
  duration: number; // in seconds, float
  fileSize: number; // in bytes
  timestamp: number; // Unix timestamp ms
  storageStatus: StorageStatus;
  submissionStatus: 'submitted';
  attemptNumber: number;
  reviewStatus: ReviewStatus;
  reviewDecision?: ReviewRecord;
  dataUseStatus: {
    speechRecognitionModel: DataUseStatus;
    clinicalAcousticResearch: DataUseStatus;
    openResearchRepository: DataUseStatus;
  };
}

export interface AudioStorageFile {
  path: string; // key: recordings/SPK_0001/level_1/rec_xxx.wav
  blob: Blob;
  mimeType: string;
  createdAt: number;
}

export interface ReviewAudioData {
  tempBlob: Blob;
  sentence: Sentence;
  duration: number;
  sampleRate: number;
  channelCount: number;
  bitDepth: number;
}

export interface ParticipantProgress {
  userId: string;
  cohort: Cohort;
  targetPerLevel: number; // Default 1 sentence per level (3 total), configurable
  currentPromptIndex: Record<SentenceLevel, number>; // 1-based prompt index (1 -> S01, 2 -> S02)
  completedPrompts: string[]; // List of promptIds submitted (e.g. ["L1_S01"])
  lastUpdated: number;
}

export type DeletionRequestStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Processing'
  | 'Completed'
  | 'Partially Completed / Exception Recorded';

export type DeletionRequestType =
  | 'withdrawal_and_deletion'
  | 'data_deletion_only'
  | 'consent_withdrawal';

export interface DeletionRequest {
  id: string; // e.g. DEL_REQ_001
  userId: string;
  participantId: string;
  requestType: DeletionRequestType;
  targetRecordingId?: string; // Specific recording ID if single audio take deletion
  targetPromptId?: string; // Associated Prompt ID
  submissionDate: number;
  affectedRecordingsCount: number;
  assignedStaff: string;
  status: DeletionRequestStatus;
  notes?: string;
  completionDate?: number;
  actionHistory?: {
    status: DeletionRequestStatus;
    updatedBy: string;
    timestamp: number;
    comment?: string;
  }[];
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  details: string;
  timestamp: number;
  targetId?: string;
}

export type ActiveScreen =
  | 'welcome'
  | 'login'
  | 'register'
  | 'consent'
  | 'registration_success'
  | 'home'
  | 'sentence_list'
  | 'recording_modal'
  | 'review_modal'
  | 'my_recordings'
  | 'recording_details'
  | 'profile_settings'
  // Admin screens
  | 'admin_dashboard'
  | 'admin_reviews'
  | 'admin_deletions'
  | 'admin_profile';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
