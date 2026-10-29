import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  User,
  ConsentRecord,
  Sentence,
  Recording,
  ParticipantProgress,
  DeletionRequest,
  AuditLog,
  ReviewRecord,
} from '../types';
import { getDefaultSentences } from '../data/sampleSentences';

// Convert Supabase DB User Row to Application User
function mapUserFromDb(row: any): User {
  return {
    id: row.id,
    participantId: row.participant_id,
    name: row.name,
    email: row.email,
    mobileNumber: row.mobile_number || undefined,
    role: row.role,
    cohort: row.cohort,
    gender: row.gender,
    age: row.age ? Number(row.age) : undefined,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    status: row.status,
  };
}

// Convert Application User to Supabase DB Row
function mapUserToDb(user: User): any {
  return {
    id: user.id,
    participant_id: user.participantId,
    name: user.name,
    email: user.email.trim().toLowerCase(),
    mobile_number: user.mobileNumber || null,
    role: user.role,
    cohort: user.cohort,
    gender: user.gender,
    age: user.age || null,
    password_hash: user.passwordHash,
    password_salt: user.passwordSalt,
    status: user.status,
    created_at: new Date(user.createdAt).toISOString(),
  };
}

// Convert Supabase DB Recording Row to Application Recording
function mapRecordingFromDb(row: any): Recording {
  return {
    id: row.id,
    recordingId: row.recording_id || row.id,
    userId: row.user_id,
    speakerId: row.speaker_id,
    participantId: row.speaker_id,
    sentenceId: row.sentence_id,
    promptId: row.prompt_id,
    level: row.level,
    cohort: row.cohort,
    localFilePath: row.local_audio_path,
    audioFormat: row.audio_format || 'audio/wav',
    sampleRate: row.sample_rate || 16000,
    bitDepth: row.bit_depth || 16,
    channelCount: row.channel_count || 1,
    duration: Number(row.duration),
    fileSize: Number(row.file_size_bytes || 0),
    timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    storageStatus: row.storage_backend === 'google_cloud_storage' ? 'uploaded' : 'saved_local',
    submissionStatus: row.submission_status || 'submitted',
    attemptNumber: row.attempt_number || 1,
    reviewStatus: row.review_status || 'pending',
    dataUseStatus: row.data_use_status || {
      speechRecognitionModel: 'approved',
      clinicalAcousticResearch: 'approved',
      openResearchRepository: 'not_used',
    },
  };
}

// Convert Application Recording to Supabase DB Row
function mapRecordingToDb(rec: Recording): any {
  return {
    id: rec.id,
    recording_id: rec.recordingId || rec.id,
    user_id: rec.userId,
    speaker_id: rec.speakerId || rec.participantId,
    sentence_id: rec.sentenceId,
    prompt_id: rec.promptId,
    level: rec.level,
    cohort: rec.cohort,
    local_audio_path: rec.localFilePath,
    cloud_storage_uri: null,
    storage_backend: 'system_local',
    audio_format: rec.audioFormat || 'audio/wav',
    sample_rate: rec.sampleRate || 16000,
    bit_depth: rec.bitDepth || 16,
    channel_count: rec.channelCount || 1,
    duration: rec.duration,
    file_size_bytes: rec.fileSize,
    submission_status: rec.submissionStatus || 'submitted',
    attempt_number: rec.attemptNumber || 1,
    review_status: rec.reviewStatus || 'pending',
    data_use_status: rec.dataUseStatus,
    created_at: new Date(rec.timestamp).toISOString(),
  };
}

// Convert Supabase DB Sentence Row to Application Sentence
function mapSentenceFromDb(row: any): Sentence {
  return {
    id: row.id,
    promptId: row.prompt_id || row.id,
    level: row.level,
    sentenceNumber: row.sentence_number,
    text: row.text,
    instructionNotes: row.instruction_notes,
    category: row.category,
    difficultyLevel: row.difficulty_level,
    active: row.active ?? true,
  };
}

export class SupabaseDbService {
  // --- Users Operations ---
  async addUser(user: User): Promise<void> {
    const row = mapUserToDb(user);
    const { error } = await supabase.from('users').insert([row]);
    if (error) {
      console.error('Supabase addUser error:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error) {
      console.error('Supabase getUserByEmail error:', error);
      return null;
    }
    return data ? mapUserFromDb(data) : null;
  }

  async getUserByMobileNumber(mobileNumber: string): Promise<User | null> {
    const cleanDigits = mobileNumber.replace(/\D/g, '').slice(-10);
    if (!cleanDigits) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('mobile_number', `%${cleanDigits}`)
      .maybeSingle();

    if (error) {
      console.error('Supabase getUserByMobileNumber error:', error);
      return null;
    }
    return data ? mapUserFromDb(data) : null;
  }

  async getUserByParticipantId(participantId: string): Promise<User | null> {
    const cleanId = participantId.trim().toUpperCase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('participant_id', cleanId)
      .maybeSingle();

    if (error) {
      console.error('Supabase getUserByParticipantId error:', error);
      return null;
    }
    return data ? mapUserFromDb(data) : null;
  }

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Supabase getUserById error:', error);
      return null;
    }
    return data ? mapUserFromDb(data) : null;
  }

  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getAllUsers error:', error);
      return [];
    }
    return (data || []).map(mapUserFromDb);
  }

  async getAllParticipants(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getAllParticipants error:', error);
      return [];
    }
    return (data || []).map(mapUserFromDb);
  }

  async updateUser(user: User): Promise<void> {
    const row = mapUserToDb(user);
    const { error } = await supabase
      .from('users')
      .update(row)
      .eq('id', user.id);

    if (error) {
      console.error('Supabase updateUser error:', error);
      throw error;
    }
  }

  // --- Consents Operations ---
  async addConsent(consent: ConsentRecord): Promise<void> {
    const row = {
      id: consent.id,
      user_id: consent.userId,
      consent_version: consent.consentVersion,
      consent_status: consent.consentStatus,
      agreed_terms: consent.agreedTerms,
      created_at: new Date(consent.timestamp).toISOString(),
    };
    const { error } = await supabase.from('consents').insert([row]);
    if (error) {
      console.error('Supabase addConsent error:', error);
      throw error;
    }
  }

  async getLatestConsentForUser(userId: string): Promise<ConsentRecord | null> {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase getLatestConsentForUser error:', error);
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      consentVersion: data.consent_version,
      consentStatus: data.consent_status,
      agreedTerms: data.agreed_terms || [],
      timestamp: new Date(data.created_at).getTime(),
    };
  }

  // --- Sentences Operations ---
  async getAllSentences(): Promise<Sentence[]> {
    const { data, error } = await supabase
      .from('sentences')
      .select('*')
      .order('level', { ascending: true })
      .order('sentence_number', { ascending: true });

    if (error || !data || data.length === 0) {
      // Seed default sentences into Supabase if empty
      const defaults = getDefaultSentences();
      try {
        const rows = defaults.map((s) => ({
          id: s.id,
          prompt_id: s.promptId || s.id,
          level: s.level,
          sentence_number: s.sentenceNumber,
          text: s.text,
          instruction_notes: s.instructionNotes || null,
          category: s.category || null,
          difficulty_level: s.difficultyLevel || null,
          active: s.active,
        }));
        await supabase.from('sentences').upsert(rows);
      } catch (seedErr) {
        console.warn('Failed to auto-seed sentences in Supabase:', seedErr);
      }
      return defaults;
    }

    return data.map(mapSentenceFromDb);
  }

  async getSentencesByLevel(level: number): Promise<Sentence[]> {
    const all = await this.getAllSentences();
    return all.filter((s) => s.level === level);
  }

  async getSentenceById(id: string): Promise<Sentence | null> {
    const { data, error } = await supabase
      .from('sentences')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return mapSentenceFromDb(data);
  }

  async getSentenceByPromptId(promptId: string): Promise<Sentence | null> {
    const cleanId = promptId.trim().toUpperCase();
    const { data, error } = await supabase
      .from('sentences')
      .select('*')
      .or(`prompt_id.eq.${cleanId},id.eq.${cleanId}`)
      .maybeSingle();

    if (error || !data) return null;
    return mapSentenceFromDb(data);
  }

  // --- Recordings Operations ---
  async addRecording(recording: Recording): Promise<void> {
    const row = mapRecordingToDb(recording);
    const { error } = await supabase.from('recordings').upsert([row]);
    if (error) {
      console.error('Supabase addRecording error:', error);
      throw error;
    }
  }

  async updateRecording(recording: Recording): Promise<void> {
    return this.addRecording(recording);
  }

  async getRecordingsForUser(userId: string): Promise<Recording[]> {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getRecordingsForUser error:', error);
      return [];
    }
    return (data || []).map(mapRecordingFromDb);
  }

  async getAllRecordings(): Promise<Recording[]> {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getAllRecordings error:', error);
      return [];
    }
    return (data || []).map(mapRecordingFromDb);
  }

  async getRecordingById(id: string): Promise<Recording | null> {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return mapRecordingFromDb(data);
  }

  async getRecordingsForSentence(userId: string, sentenceId: string): Promise<Recording[]> {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('user_id', userId)
      .eq('sentence_id', sentenceId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []).map(mapRecordingFromDb);
  }

  async deleteRecording(id: string): Promise<void> {
    const { error } = await supabase.from('recordings').delete().eq('id', id);
    if (error) {
      console.error('Supabase deleteRecording error:', error);
      throw error;
    }
  }

  // --- Participant Progress Operations ---
  async getParticipantProgress(userId: string): Promise<ParticipantProgress | null> {
    const { data, error } = await supabase
      .from('participant_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      userId: data.user_id,
      cohort: data.cohort,
      targetPerLevel: data.target_per_level,
      currentPromptIndex: data.current_prompt_index || { 1: 1, 2: 1, 3: 1 },
      completedPrompts: data.completed_prompts || [],
      lastUpdated: new Date(data.last_updated).getTime(),
    };
  }

  async saveParticipantProgress(progress: ParticipantProgress): Promise<void> {
    const row = {
      user_id: progress.userId,
      cohort: progress.cohort,
      target_per_level: progress.targetPerLevel,
      current_prompt_index: progress.currentPromptIndex,
      completed_prompts: progress.completedPrompts,
      last_updated: new Date(progress.lastUpdated).toISOString(),
    };
    const { error } = await supabase.from('participant_progress').upsert([row]);
    if (error) {
      console.error('Supabase saveParticipantProgress error:', error);
      throw error;
    }
  }

  // --- Deletion Requests Operations ---
  async getDeletionRequests(userId?: string): Promise<DeletionRequest[]> {
    let query = supabase.from('deletion_requests').select('*');
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query.order('submission_date', { ascending: false });

    if (error) return [];
    return (data || []).map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      participantId: d.participant_id,
      requestType: d.request_type,
      targetRecordingId: d.target_recording_id,
      targetPromptId: d.target_prompt_id,
      submissionDate: new Date(d.submission_date).getTime(),
      affectedRecordingsCount: d.affected_recordings_count,
      assignedStaff: d.assigned_staff,
      status: d.status,
      notes: d.notes,
      completionDate: d.completion_date ? new Date(d.completion_date).getTime() : undefined,
      actionHistory: d.action_history || [],
    }));
  }

  async getDeletionRequestById(id: string): Promise<DeletionRequest | null> {
    const { data, error } = await supabase
      .from('deletion_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      participantId: data.participant_id,
      requestType: data.request_type,
      targetRecordingId: data.target_recording_id,
      targetPromptId: data.target_prompt_id,
      submissionDate: new Date(data.submission_date).getTime(),
      affectedRecordingsCount: data.affected_recordings_count,
      assignedStaff: data.assigned_staff,
      status: data.status,
      notes: data.notes,
      completionDate: data.completion_date ? new Date(data.completion_date).getTime() : undefined,
      actionHistory: data.action_history || [],
    };
  }

  async addDeletionRequest(request: DeletionRequest): Promise<void> {
    const row = {
      id: request.id,
      user_id: request.userId,
      participant_id: request.participantId,
      request_type: request.requestType,
      target_recording_id: request.targetRecordingId || null,
      target_prompt_id: request.targetPromptId || null,
      affected_recordings_count: request.affectedRecordingsCount,
      assigned_staff: request.assignedStaff,
      status: request.status,
      notes: request.notes || null,
      action_history: request.actionHistory || [],
      submission_date: new Date(request.submissionDate).toISOString(),
      completion_date: request.completionDate ? new Date(request.completionDate).toISOString() : null,
    };
    const { error } = await supabase.from('deletion_requests').upsert([row]);
    if (error) {
      console.error('Supabase addDeletionRequest error:', error);
      throw error;
    }
  }

  async updateDeletionRequest(request: DeletionRequest): Promise<void> {
    return this.addDeletionRequest(request);
  }

  // --- Audit Logs Operations ---
  async addAuditLog(log: AuditLog): Promise<void> {
    const row = {
      id: log.id,
      action: log.action,
      performed_by: log.performedBy,
      details: log.details,
      target_id: log.targetId || null,
      created_at: new Date(log.timestamp).toISOString(),
    };
    const { error } = await supabase.from('audit_logs').insert([row]);
    if (error) {
      console.error('Supabase addAuditLog error:', error);
    }
  }

  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []).map((l: any) => ({
      id: l.id,
      action: l.action,
      performedBy: l.performed_by,
      details: l.details,
      targetId: l.target_id,
      timestamp: new Date(l.created_at).getTime(),
    }));
  }

  // --- Reviews Operations ---
  async addReviewRecord(review: ReviewRecord): Promise<void> {
    const row = {
      id: review.id,
      recording_id: review.recordingId,
      reviewer_id: review.reviewerId,
      reviewer_email: review.reviewerEmail || null,
      decision: review.decision,
      reason: review.reason || null,
      checklist: review.checklist,
      created_at: new Date(review.timestamp).toISOString(),
    };
    const { error } = await supabase.from('reviews').insert([row]);
    if (error) {
      console.error('Supabase addReviewRecord error:', error);
      throw error;
    }

    // Also update reviewStatus in recordings table
    await supabase
      .from('recordings')
      .update({ review_status: review.decision })
      .eq('id', review.recordingId);
  }

  async getReviewsForRecording(recordingId: string): Promise<ReviewRecord[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('recording_id', recordingId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []).map((r: any) => ({
      id: r.id,
      recordingId: r.recording_id,
      reviewerId: r.reviewer_id,
      reviewerEmail: r.reviewer_email,
      decision: r.decision,
      reason: r.reason,
      checklist: r.checklist,
      timestamp: new Date(r.created_at).getTime(),
    }));
  }
}

export const supabaseDbService = new SupabaseDbService();
