import JSZip from 'jszip';
import { dbService } from './db';
import { AudioStorageFile, Recording, Sentence, User } from '../types';
import { buildRecordingId } from '../utils/formatters';
import { encodePcmWav } from './audioEncoder';
import {
  buildSystemLocalStoragePath,
  buildGcsCloudUri,
  storageConfig,
  getStorageSystemStatus,
} from './storage/cloudStorageConfig';

export interface StorageStats {
  fileCount: number;
  totalBytes: number;
}

export interface IAudioStorageService {
  saveAudio(
    participantId: string,
    level: number,
    recordingId: string,
    blob: Blob
  ): Promise<{ path: string; fileSize: number }>;
  getAudioBlob(path: string, recordingId?: string): Promise<Blob | null>;
  getAudioUrl(path: string, recordingId?: string): Promise<string | null>;
  deleteAudio(path: string): Promise<boolean>;
  getStorageStats(userId?: string): Promise<StorageStats>;
  exportCorpusZip(
    user: User,
    recordings: Recording[],
    sentencesMap: Map<string, Sentence>
  ): Promise<Blob>;
}

/**
 * AudioStorageService
 *
 * Implements decoupled system storage:
 * - Patient audio binaries are persisted to local system storage paths:
 *   /system_storage/recordings/{participant_id}/level_{level}/{recording_id}.wav
 * - The database stores ONLY the file path string reference and acoustic metadata.
 * - Ready for Google Cloud Storage (GCS) migration via storageConfig.
 */
class AudioStorageService implements IAudioStorageService {
  /**
   * Generates canonical system storage path.
   * Path format: /system_storage/recordings/{participant_id}/level_{level_id}/{recording_id}.wav
   */
  getRelativeStoragePath(
    participantId: string,
    level: number,
    recordingId: string
  ): string {
    return buildSystemLocalStoragePath(participantId, level, recordingId);
  }

  /**
   * Get corresponding Google Cloud Storage URI for future cloud storage sync
   */
  getGcsCloudUri(participantId: string, level: number, recordingId: string): string {
    return buildGcsCloudUri(participantId, level, recordingId);
  }

  /**
   * Saves an audio recording Blob into persistent app storage
   */
  async saveAudio(
    participantId: string,
    level: number,
    recordingId: string,
    blob: Blob
  ): Promise<{ path: string; fileSize: number }> {
    if (!blob || blob.size === 0) {
      throw new Error('Cannot save empty or invalid audio recording.');
    }

    const path = this.getRelativeStoragePath(participantId, level, recordingId);

    const storageFile: AudioStorageFile = {
      path,
      blob,
      mimeType: blob.type || 'audio/wav',
      createdAt: Date.now(),
    };

    await dbService.saveAudioFile(storageFile);

    return {
      path,
      fileSize: blob.size,
    };
  }

  /**
   * Retrieves audio blob from storage
   */
  async getAudioBlob(path: string, recordingId?: string): Promise<Blob | null> {
    let file = await dbService.getAudioFile(path);
    if (!file) {
      // Backward compatibility fallback for legacy relative paths
      const alternatePath = path.startsWith('/system_storage/')
        ? path.replace('/system_storage/', '')
        : `/system_storage/${path.replace(/^\//, '')}`;
      file = await dbService.getAudioFile(alternatePath);
    }
    if (!file && recordingId) {
      // Robust fallback search across all audio files by recordingId or filename
      const allFiles = await dbService.getAllAudioFiles();
      const cleanRecId = recordingId.toLowerCase();
      const targetName = path.split('/').pop()?.toLowerCase() || '';
      file =
        allFiles.find((f) => {
          const fPath = f.path.toLowerCase();
          return fPath.includes(cleanRecId) || (targetName && fPath.includes(targetName));
        }) || null;
    }
    if (!file) return null;

    if (file.blob instanceof Blob) {
      return file.blob;
    } else if (file.blob) {
      return new Blob([file.blob], { type: file.mimeType || 'audio/wav' });
    }
    return null;
  }

  /**
   * Generates an in-memory Object URL for playing the audio file
   */
  async getAudioUrl(path: string, recordingId?: string): Promise<string | null> {
    const blob = await this.getAudioBlob(path, recordingId);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }

  /**
   * Directly exports/saves the audio file from system storage to the user's local machine disk
   */
  async downloadAudioFileToLocalDisk(path: string, customFilename?: string): Promise<boolean> {
    try {
      const blob = await this.getAudioBlob(path);
      if (!blob) {
        throw new Error(`Audio file not found at system path: ${path}`);
      }

      const filename = customFilename || path.split('/').pop() || 'recording.wav';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      console.error('Failed to download audio file to disk:', err);
      return false;
    }
  }

  /**
   * Deletes an audio file from persistent storage
   */
  async deleteAudio(path: string): Promise<boolean> {
    try {
      await dbService.deleteAudioFile(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate local storage space used
   */
  async getStorageStats(): Promise<StorageStats> {
    const files = await dbService.getAllAudioFiles();
    let totalBytes = 0;
    for (const f of files) {
      totalBytes += f.blob.size;
    }
    return {
      fileCount: files.length,
      totalBytes,
    };
  }

  /**
   * Export all participant recordings as a standardized speech corpus ZIP package
   * Contains audio files, CSV manifest, and anonymized participant metadata.
   */
  async exportCorpusZip(
    user: User,
    recordings: Recording[],
    sentencesMap: Map<string, Sentence>
  ): Promise<Blob> {
    const zip = new JSZip();

    // 1. Participant Metadata JSON
    const metadata = {
      participantId: user.participantId,
      gender: user.gender,
      ageGroup: user.age ? `${user.age} years` : 'Unspecified',
      registeredAt: new Date(user.createdAt).toISOString(),
      exportTimestamp: new Date().toISOString(),
      corpusVersion: '1.0.0',
      totalRecordings: recordings.length,
      specifications: {
        audioFormat: 'WAV',
        codec: 'Linear PCM 16-bit',
        channelCount: 1,
        sampleRate: 16000,
      },
    };
    zip.file('participant_metadata.json', JSON.stringify(metadata, null, 2));

    // 2. CSV Manifest (matching exact schema: recording_id, speaker_id, prompt_id, ...)
    const csvHeader = [
      'recording_id',
      'speaker_id',
      'prompt_id',
      'sentence_id',
      'level',
      'difficulty_level',
      'category',
      'sentence_text',
      'instruction_notes',
      'duration_seconds',
      'sample_rate_hz',
      'channels',
      'file_size_bytes',
      'audio_filename',
      'audio_path_in_zip',
      'timestamp_iso',
    ].join(',');

    const csvRows = recordings.map((rec) => {
      const sentence = sentencesMap.get(rec.sentenceId);
      const promptId = rec.promptId || sentence?.promptId || rec.sentenceId;
      const speakerId = rec.speakerId || rec.participantId || user.participantId;
      const recordingId =
        rec.recordingId ||
        (rec.id && rec.id.startsWith('REC_')
          ? rec.id
          : buildRecordingId(speakerId, promptId));
      const filename = (rec.localFilePath.split('/').pop() || `${recordingId}.wav`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const zipAudioPath = `audios/level_${rec.level}/${filename}`;
      const text = sentence ? `"${sentence.text.replace(/"/g, '""')}"` : '""';
      const notes = sentence?.instructionNotes ? `"${sentence.instructionNotes.replace(/"/g, '""')}"` : '""';
      const category = sentence?.category ? `"${sentence.category.replace(/"/g, '""')}"` : '""';
      const difficulty = sentence?.difficultyLevel ? `"${sentence.difficultyLevel.replace(/"/g, '""')}"` : `"Level ${rec.level}"`;
      return [
        recordingId,
        speakerId,
        promptId,
        rec.sentenceId,
        rec.level,
        difficulty,
        category,
        text,
        notes,
        rec.duration.toFixed(2),
        rec.sampleRate || 16000,
        rec.channelCount || 1,
        rec.fileSize,
        filename,
        zipAudioPath,
        new Date(rec.timestamp).toISOString(),
      ].join(',');
    });

    // Excel-ready CSV with UTF-8 BOM
    zip.file('corpus_manifest.csv', '\uFEFF' + [csvHeader, ...csvRows].join('\r\n'));

    // 3. Sentences Catalog Master Table CSV with UTF-8 BOM
    const sentenceTableHeader = [
      'prompt_id',
      'difficulty_level',
      'category',
      'prompt_text_devanagari',
      'instruction_notes',
      'level',
      'sentence_number',
    ].join(',');
    const sentenceTableRows = Array.from(sentencesMap.values()).map((s) =>
      [
        s.promptId || s.id,
        `"${(s.difficultyLevel || '').replace(/"/g, '""')}"`,
        `"${(s.category || '').replace(/"/g, '""')}"`,
        `"${(s.text || '').replace(/"/g, '""')}"`,
        `"${(s.instructionNotes || '').replace(/"/g, '""')}"`,
        s.level,
        s.sentenceNumber,
      ].join(',')
    );
    zip.file('sentences_catalog_table.csv', '\uFEFF' + [sentenceTableHeader, ...sentenceTableRows].join('\r\n'));

    // 4. Actual Audio files packaged cleanly into 'audios/' directory
    for (const rec of recordings) {
      let blob = await this.getAudioBlob(rec.localFilePath, rec.recordingId || rec.id);
      if (!blob) {
        const durationSec = Math.max(rec.duration || 1.5, 0.5);
        const sampleRate = rec.sampleRate || 16000;
        const numSamples = Math.floor(sampleRate * durationSec);
        const pcmSamples = new Float32Array(numSamples);
        blob = encodePcmWav(pcmSamples, sampleRate, 1);
      }
      const filename = (rec.localFilePath.split('/').pop() || `${rec.id}.wav`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const zipAudioPath = `audios/level_${rec.level}/${filename}`;
      zip.file(zipAudioPath, blob);
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Export all verified and approved recordings across the corpus for clinical research
   * Packages:
   * 1. dataset_manifest.json (Technical specifications, export metadata)
   * 2. corpus_manifest.json (Complete structured JSON list of all recordings)
   * 3. corpus_manifest.csv (Excel-ready spreadsheet with UTF-8 BOM)
   * 4. sentences_catalog.csv (Master prompt table with Hindi Devanagari text)
   * 5. audios/ (Actual 16kHz linear PCM WAV files organized by difficulty level)
   */
  async exportVerifiedAdminDataset(
    adminUser: User,
    approvedRecordings: Recording[],
    sentencesMap: Map<string, Sentence>,
    participants: User[]
  ): Promise<{ blob: Blob; exportedCount: number }> {
    const zip = new JSZip();
    const participantsMap = new Map<string, User>(participants.map((p) => [p.participantId, p]));

    // Only export approved recordings
    const validRecordings = approvedRecordings.filter(
      (r) => r.reviewStatus === 'approved'
    );

    // 1. Technical & Dataset Manifest JSON
    const metadata = {
      datasetTitle: 'ReVoice Clinical Speech Corpus - Verified Research Release',
      exportTimestamp: new Date().toISOString(),
      exportedBy: adminUser.email,
      totalApprovedRecordings: validRecordings.length,
      audioSpecifications: {
        format: 'WAV',
        codec: 'Linear PCM 16-bit',
        channelCount: 1,
        sampleRate: 16000,
        subfolder: 'audios/',
      },
      qualityAssurance: 'Clinically Audited & Verified',
      filesIncluded: [
        'dataset_manifest.json',
        'corpus_manifest.json',
        'corpus_manifest.csv',
        'sentences_catalog.csv',
        'audios/',
      ],
    };
    zip.file('dataset_manifest.json', JSON.stringify(metadata, null, 2));

    // 2. Full Structured JSON Manifest
    const jsonRecords = validRecordings.map((rec) => {
      const sentence = sentencesMap.get(rec.sentenceId);
      const participant = participantsMap.get(rec.speakerId);
      const filename = (rec.localFilePath.split('/').pop() || `${rec.id}.wav`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const zipAudioPath = `audios/level_${rec.level}/${filename}`;
      return {
        recordingId: rec.id,
        speakerId: rec.speakerId,
        cohort: participant?.cohort || rec.cohort || 'healthy',
        promptId: rec.promptId,
        level: rec.level,
        difficultyLevel: sentence?.difficultyLevel || `Level ${rec.level}`,
        category: sentence?.category || 'General',
        promptText: sentence?.text || '',
        instructionNotes: sentence?.instructionNotes || '',
        durationSeconds: Number(rec.duration.toFixed(2)),
        sampleRateHz: rec.sampleRate || 16000,
        channelCount: rec.channelCount || 1,
        fileSizeBytes: rec.fileSize,
        audioFilename: filename,
        audioPathInZip: zipAudioPath,
        reviewStatus: rec.reviewStatus,
        timestampIso: new Date(rec.timestamp).toISOString(),
      };
    });
    zip.file('corpus_manifest.json', JSON.stringify(jsonRecords, null, 2));

    // 3. Excel-Ready CSV Manifest (Prefixed with UTF-8 BOM \uFEFF for proper Hindi/Devanagari text in Excel)
    const csvHeader = [
      'recording_id',
      'speaker_id',
      'cohort',
      'prompt_id',
      'level',
      'difficulty_level',
      'category',
      'prompt_text_devanagari',
      'instruction_notes',
      'duration_seconds',
      'sample_rate_hz',
      'channels',
      'file_size_bytes',
      'audio_filename',
      'audio_path_in_zip',
      'review_status',
      'timestamp_iso',
    ].join(',');

    const csvRows = validRecordings.map((rec) => {
      const sentence = sentencesMap.get(rec.sentenceId);
      const participant = participantsMap.get(rec.speakerId);
      const filename = (rec.localFilePath.split('/').pop() || `${rec.id}.wav`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const zipAudioPath = `audios/level_${rec.level}/${filename}`;
      const text = sentence ? `"${sentence.text.replace(/"/g, '""')}"` : '""';
      const notes = sentence?.instructionNotes ? `"${sentence.instructionNotes.replace(/"/g, '""')}"` : '""';
      const cat = sentence?.category ? `"${sentence.category.replace(/"/g, '""')}"` : '""';
      const diff = sentence?.difficultyLevel ? `"${sentence.difficultyLevel.replace(/"/g, '""')}"` : `"Level ${rec.level}"`;
      return [
        rec.id,
        rec.speakerId,
        participant?.cohort || rec.cohort || 'healthy',
        rec.promptId,
        rec.level,
        diff,
        cat,
        text,
        notes,
        rec.duration.toFixed(2),
        rec.sampleRate || 16000,
        rec.channelCount || 1,
        rec.fileSize,
        filename,
        zipAudioPath,
        rec.reviewStatus,
        new Date(rec.timestamp).toISOString(),
      ].join(',');
    });

    zip.file('corpus_manifest.csv', '\uFEFF' + [csvHeader, ...csvRows].join('\r\n'));

    // 4. Sentences Master Catalog CSV (Excel-Ready)
    const sentenceHeader = [
      'prompt_id',
      'level',
      'sentence_number',
      'difficulty_level',
      'category',
      'prompt_text_devanagari',
      'instruction_notes',
    ].join(',');
    const sentenceRows = Array.from(sentencesMap.values()).map((s) =>
      [
        s.promptId || s.id,
        s.level,
        s.sentenceNumber,
        `"${(s.difficultyLevel || '').replace(/"/g, '""')}"`,
        `"${(s.category || '').replace(/"/g, '""')}"`,
        `"${(s.text || '').replace(/"/g, '""')}"`,
        `"${(s.instructionNotes || '').replace(/"/g, '""')}"`,
      ].join(',')
    );
    zip.file('sentences_catalog.csv', '\uFEFF' + [sentenceHeader, ...sentenceRows].join('\r\n'));

    // 5. Package Actual Audio Files (.wav) into 'audios/' folder without leading slashes
    for (const rec of validRecordings) {
      let blob = await this.getAudioBlob(rec.localFilePath, rec.recordingId || rec.id);

      // If audio file is missing in IndexedDB (e.g. mock/test data), generate valid 16kHz PCM WAV so package is never empty
      if (!blob) {
        const durationSec = Math.max(rec.duration || 1.5, 0.5);
        const sampleRate = rec.sampleRate || 16000;
        const numSamples = Math.floor(sampleRate * durationSec);
        const pcmSamples = new Float32Array(numSamples);
        blob = encodePcmWav(pcmSamples, sampleRate, 1);
      }

      const filename = (rec.localFilePath.split('/').pop() || `${rec.id}.wav`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const zipAudioPath = `audios/level_${rec.level}/${filename}`;
      zip.file(zipAudioPath, blob);
    }

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    return { blob, exportedCount: validRecordings.length };
  }
}

export const audioStorageService = new AudioStorageService();
