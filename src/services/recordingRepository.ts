import { dbService } from './db';
import { audioStorageService } from './audioStorageService';
import { convertBlobToWav } from './audioEncoder';
import { Recording, Sentence, SentenceLevel, ReviewRecord, ReviewStatus, Cohort } from '../types';
import { buildRecordingId } from '../utils/formatters';

export interface LevelProgress {
  level: SentenceLevel;
  totalSentences: number;
  distinctRecorded: number;
  percentage: number;
}

export interface UserStats {
  totalSentencesInCorpus: number;
  totalDistinctRecorded: number;
  overallPercentage: number;
  totalAttempts: number;
  totalDurationSeconds: number;
  levels: Record<SentenceLevel, LevelProgress>;
}

export class RecordingRepository {
  /**
   * Retrieves all recordings for a given participant, normalizing to canonical ID format
   */
  async getRecordings(userId: string): Promise<Recording[]> {
    const list = await dbService.getRecordingsForUser(userId);
    return list.map((rec) => {
      const promptId = rec.promptId || rec.sentenceId;
      const speakerId = rec.speakerId || rec.participantId;
      const recId =
        rec.recordingId ||
        (rec.id && rec.id.startsWith('REC_')
          ? rec.id
          : buildRecordingId(speakerId, promptId));

      return {
        ...rec,
        id: recId,
        recordingId: recId,
        speakerId,
        participantId: speakerId,
        promptId,
        reviewStatus: rec.reviewStatus || 'pending',
        submissionStatus: 'submitted',
        cohort: rec.cohort || 'healthy',
        dataUseStatus: rec.dataUseStatus || {
          speechRecognitionModel: 'approved',
          clinicalAcousticResearch: 'approved',
          openResearchRepository: 'not_used',
        },
      };
    });
  }

  /**
   * Retrieves all recordings in system (Admin role authorized)
   */
  async getAllRecordings(): Promise<Recording[]> {
    const list = await dbService.getAllRecordings();
    return list.map((rec) => {
      const promptId = rec.promptId || rec.sentenceId;
      const speakerId = rec.speakerId || rec.participantId;
      const recId =
        rec.recordingId ||
        (rec.id && rec.id.startsWith('REC_')
          ? rec.id
          : buildRecordingId(speakerId, promptId));

      return {
        ...rec,
        id: recId,
        recordingId: recId,
        speakerId,
        participantId: speakerId,
        promptId,
        reviewStatus: rec.reviewStatus || 'pending',
        submissionStatus: 'submitted',
        cohort: rec.cohort || 'healthy',
        dataUseStatus: rec.dataUseStatus || {
          speechRecognitionModel: 'approved',
          clinicalAcousticResearch: 'approved',
          openResearchRepository: 'not_used',
        },
      };
    });
  }

  /**
   * Retrieves all attempts for a specific sentence
   */
  async getSentenceRecordings(userId: string, sentenceId: string): Promise<Recording[]> {
    return await dbService.getRecordingsForSentence(userId, sentenceId);
  }

  /**
   * Saves a newly recorded audio take
   * 1. Resamples and encodes to 16-bit Linear PCM WAV (16kHz Mono)
   * 2. Writes to app-private storage path
   * 3. Saves metadata to local database with reviewStatus: 'pending'
   */
  async saveRecording(
    userId: string,
    participantId: string,
    sentence: Sentence,
    rawAudioBlob: Blob,
    cohort: Cohort = 'healthy'
  ): Promise<Recording> {
    if (!rawAudioBlob || rawAudioBlob.size === 0) {
      throw new Error('Audio recording data is empty.');
    }

    // 1. Standardize to 16-bit Linear PCM WAV (16,000 Hz, mono)
    const { wavBlob, duration, sampleRate, channelCount, bitDepth } =
      await convertBlobToWav(rawAudioBlob, 16000);

    // 2. Determine attempt number (preserving history)
    const existing = await dbService.getRecordingsForSentence(userId, sentence.id);
    const attemptNumber = existing.length + 1;

    // 3. Generate canonical recording identifier (e.g. REC_SPK0001_L1S01)
    const promptId = sentence.promptId || sentence.id;
    const speakerId = participantId;
    const recordingId = buildRecordingId(speakerId, promptId);

    // 4. Save to app-private storage
    const { path, fileSize } = await audioStorageService.saveAudio(
      speakerId,
      sentence.level,
      recordingId,
      wavBlob
    );

    // 5. Check active consent to set authorized data use
    const consent = await dbService.getLatestConsentForUser(userId);
    const hasConsent = consent && consent.consentStatus === 'accepted';

    // 6. Construct persistent database entity with canonical keys
    const newRecording: Recording = {
      id: recordingId,
      recordingId,
      speakerId,
      userId,
      participantId: speakerId,
      sentenceId: sentence.id,
      promptId,
      level: sentence.level,
      cohort,
      localFilePath: path,
      audioFormat: 'audio/wav',
      sampleRate,
      bitDepth,
      channelCount,
      duration,
      fileSize,
      timestamp: Date.now(),
      storageStatus: 'saved_local',
      submissionStatus: 'submitted',
      attemptNumber,
      reviewStatus: 'pending',
      dataUseStatus: {
        speechRecognitionModel: hasConsent ? 'approved' : 'not_used',
        clinicalAcousticResearch: hasConsent ? 'approved' : 'not_used',
        openResearchRepository: 'not_used', // Never assume usage without verified backend export
      },
    };

    // 7. Save in database
    await dbService.addRecording(newRecording);

    // 8. Log in audit log
    await dbService.addAuditLog({
      id: crypto.randomUUID(),
      action: 'RECORDING_SUBMITTED',
      performedBy: speakerId,
      details: `Recording take submitted: ${recordingId} (Attempt #${attemptNumber}, Level ${sentence.level})`,
      timestamp: Date.now(),
      targetId: recordingId,
    });

    return newRecording;
  }

  /**
   * Updates recording review status and saves review decision record
   */
  async submitReviewDecision(
    recordingId: string,
    decision: ReviewStatus,
    reviewerId: string,
    reviewerEmail: string,
    checklist: Record<string, boolean>,
    reason?: string
  ): Promise<Recording> {
    const recording = await dbService.getRecordingById(recordingId);
    if (!recording) throw new Error('Recording not found.');

    const reviewRecord: ReviewRecord = {
      id: crypto.randomUUID(),
      recordingId,
      reviewerId,
      reviewerEmail,
      decision,
      reason,
      checklist: {
        idConsistency: !!checklist.idConsistency,
        fileIntegrity: !!checklist.fileIntegrity,
        completeness: !!checklist.completeness,
        clarity: !!checklist.clarity,
        lowNoise: !!checklist.lowNoise,
        metadataAccurate: !!checklist.metadataAccurate,
      },
      timestamp: Date.now(),
    };

    await dbService.addReviewRecord(reviewRecord);

    recording.reviewStatus = decision;
    recording.reviewDecision = reviewRecord;

    await dbService.updateRecording(recording);

    // Log administrative action in audit log
    await dbService.addAuditLog({
      id: crypto.randomUUID(),
      action: 'RECORDING_REVIEWED',
      performedBy: reviewerEmail || reviewerId,
      details: `Recording ${recordingId} marked as ${decision.toUpperCase()}${reason ? ` (Reason: ${reason})` : ''}`,
      timestamp: Date.now(),
      targetId: recordingId,
    });

    return recording;
  }

  /**
   * Delete a recording with strict participant ownership or admin verification
   */
  async deleteRecording(recordingId: string, currentUserId: string, isAdmin: boolean = false): Promise<boolean> {
    const recording = await dbService.getRecordingById(recordingId);
    if (!recording) {
      throw new Error('Recording not found.');
    }

    if (!isAdmin && recording.userId !== currentUserId) {
      throw new Error('Access denied: Unauthorized to delete another participant’s voice data.');
    }

    await audioStorageService.deleteAudio(recording.localFilePath);
    await dbService.deleteRecording(recordingId);

    await dbService.addAuditLog({
      id: crypto.randomUUID(),
      action: 'RECORDING_DELETED',
      performedBy: currentUserId,
      details: `Recording ${recordingId} deleted by ${isAdmin ? 'Admin' : 'Participant'}`,
      timestamp: Date.now(),
      targetId: recordingId,
    });

    return true;
  }

  /**
   * Calculate progress metrics based on distinct sentence IDs recorded
   */
  calculateStats(recordings: Recording[], allSentences: Sentence[]): UserStats {
    const totalSentencesInCorpus = allSentences.length;

    const sentencesByLevel: Record<SentenceLevel, Sentence[]> = {
      1: allSentences.filter((s) => s.level === 1),
      2: allSentences.filter((s) => s.level === 2),
      3: allSentences.filter((s) => s.level === 3),
    };

    const recordedSentenceIds = new Set(recordings.map((r) => r.sentenceId));
    const totalDistinctRecorded = recordedSentenceIds.size;

    const overallPercentage =
      totalSentencesInCorpus > 0
        ? Math.round((totalDistinctRecorded / totalSentencesInCorpus) * 100)
        : 0;

    let totalDurationSeconds = 0;
    for (const r of recordings) {
      totalDurationSeconds += r.duration;
    }

    const levelsProgress = {} as Record<SentenceLevel, LevelProgress>;
    for (const lvl of [1, 2, 3] as SentenceLevel[]) {
      const lvlSentences = sentencesByLevel[lvl];
      const lvlRecordedCount = lvlSentences.filter((s) => recordedSentenceIds.has(s.id)).length;
      levelsProgress[lvl] = {
        level: lvl,
        totalSentences: lvlSentences.length,
        distinctRecorded: lvlRecordedCount,
        percentage:
          lvlSentences.length > 0
            ? Math.round((lvlRecordedCount / lvlSentences.length) * 100)
            : 0,
      };
    }

    return {
      totalSentencesInCorpus,
      totalDistinctRecorded,
      overallPercentage,
      totalAttempts: recordings.length,
      totalDurationSeconds,
      levels: levelsProgress,
    };
  }
}

export const recordingRepository = new RecordingRepository();
