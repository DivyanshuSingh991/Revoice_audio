/**
 * ReVoice Audio Storage Configuration
 *
 * Current Architecture:
 * - Patient audio recordings are saved locally in system disk storage.
 * - The database stores ONLY the file path string (e.g. /system_storage/recordings/PART_001/level_1/REC_001.wav)
 *   and acoustic metadata (fileSize, sampleRate, duration). No binary audio blobs in database tables.
 *
 * Future Architecture (Google Cloud Storage / Firebase Storage):
 * - When cloud storage is purchased, the storage provider can be switched to 'google_cloud_storage'
 * - The database keeps storing the exact same cloud path (gs://bucket/... or https://storage.googleapis.com/...)
 * - Zero schema migration needed!
 */

export type StorageBackendType = 'system_local' | 'google_cloud_storage';

export interface GoogleCloudStorageConfig {
  bucketName: string;
  projectId: string;
  region: string;
  storageClass: 'STANDARD' | 'NEARLINE' | 'COLDLINE';
  isConfigured: boolean;
}

export interface StorageSystemConfig {
  currentBackend: StorageBackendType;
  localStorageBasePath: string;
  gcsConfig: GoogleCloudStorageConfig;
}

// Active Runtime Configuration
export const storageConfig: StorageSystemConfig = {
  currentBackend: 'system_local',
  localStorageBasePath: '/system_storage/recordings',
  gcsConfig: {
    bucketName: 'revoice-speech-corpus-prod',
    projectId: 'revoice-healthcare-corpus',
    region: 'asia-south1', // Mumbai, India region
    storageClass: 'STANDARD',
    isConfigured: false, // Set to true once Google Cloud Storage credentials are provided
  },
};

/**
 * Generate standard system disk storage path
 * Output format: /system_storage/recordings/{participant_id}/level_{level_id}/{recording_id}.wav
 */
export function buildSystemLocalStoragePath(
  participantId: string,
  level: number,
  recordingId: string
): string {
  const safeParticipant = participantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeRecordingId = recordingId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${storageConfig.localStorageBasePath}/${safeParticipant}/level_${level}/${safeRecordingId}.wav`;
}

/**
 * Generate future Google Cloud Storage URI
 * Output format: gs://revoice-speech-corpus-prod/recordings/{participant_id}/level_{level_id}/{recording_id}.wav
 */
export function buildGcsCloudUri(
  participantId: string,
  level: number,
  recordingId: string
): string {
  const safeParticipant = participantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeRecordingId = recordingId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `gs://${storageConfig.gcsConfig.bucketName}/recordings/${safeParticipant}/level_${level}/${safeRecordingId}.wav`;
}

/**
 * Check readiness for Google Cloud Storage integration
 */
export function getStorageSystemStatus() {
  return {
    backend: storageConfig.currentBackend,
    activeStorageName:
      storageConfig.currentBackend === 'system_local'
        ? 'Local System Storage (Disk / Path Pointer)'
        : 'Google Cloud Storage (GCS Bucket)',
    isDatabaseDecoupled: true, // DB stores ONLY the path string, not audio blobs
    localStorageBasePath: storageConfig.localStorageBasePath,
    gcsReady: true,
    gcsConfig: storageConfig.gcsConfig,
    instructionsForGcsPurchase: [
      '1. Create a Google Cloud project at console.cloud.google.com',
      '2. In Cloud Storage, create a bucket (e.g. revoice-speech-corpus-prod in asia-south1)',
      '3. Set CORS policy on the bucket to allow audio uploads from your web domain',
      '4. Switch storageConfig.currentBackend to "google_cloud_storage"',
      '5. Uploads will automatically direct to GCS Signed URLs, while the database continues storing the cloud path reference only.',
    ],
  };
}
