import { dbService } from './db';
import { ParticipantProgress, Sentence, SentenceLevel, User } from '../types';

export class ProgressService {
  /**
   * Loads or creates participant progress state from database
   */
  async getOrCreateProgress(user: User): Promise<ParticipantProgress> {
    let progress = await dbService.getParticipantProgress(user.id);
    if (!progress) {
      progress = {
        userId: user.id,
        cohort: user.cohort || 'healthy',
        targetPerLevel: 1, // Target: 1 per level = 3 total sentences initially
        currentPromptIndex: { 1: 1, 2: 1, 3: 1 },
        completedPrompts: [],
        lastUpdated: Date.now(),
      };
      await dbService.saveParticipantProgress(progress);
    }
    return progress;
  }

  /**
   * Gets the currently assigned Sentence for a given difficulty level
   */
  getAssignedSentenceForLevel(
    progress: ParticipantProgress,
    level: SentenceLevel,
    allSentences: Sentence[]
  ): Sentence | null {
    const levelSentences = allSentences
      .filter((s) => s.level === level)
      .sort((a, b) => a.sentenceNumber - b.sentenceNumber);

    if (levelSentences.length === 0) return null;

    const currentIndex = progress.currentPromptIndex[level] || 1;
    // Find matching sentence by 1-based index (e.g. S01, S02)
    const match = levelSentences.find((s) => s.sentenceNumber === currentIndex);
    // If completed all or overflowed, return last or wraps
    return match || levelSentences[levelSentences.length - 1];
  }

  /**
   * Advances the prompt sequence for a difficulty level after a successful submission
   * Level 1: S01 -> S02 -> S03 ...
   * Maintains independent sequences for each difficulty level!
   */
  async advanceLevelSequence(
    userId: string,
    level: SentenceLevel,
    submittedPromptId: string,
    allSentences: Sentence[]
  ): Promise<ParticipantProgress> {
    const user = await dbService.getUserById(userId);
    if (!user) throw new Error('User not found.');

    const progress = await this.getOrCreateProgress(user);
    const levelSentences = allSentences.filter((s) => s.level === level);
    const maxIndex = levelSentences.length;

    const currentIdx = progress.currentPromptIndex[level] || 1;
    const nextIdx = currentIdx < maxIndex ? currentIdx + 1 : currentIdx;

    const completed = new Set(progress.completedPrompts);
    completed.add(submittedPromptId);

    const updated: ParticipantProgress = {
      ...progress,
      currentPromptIndex: {
        ...progress.currentPromptIndex,
        [level]: nextIdx,
      },
      completedPrompts: Array.from(completed),
      lastUpdated: Date.now(),
    };

    await dbService.saveParticipantProgress(updated);

    // Audit log
    await dbService.addAuditLog({
      id: crypto.randomUUID(),
      action: 'PROMPT_ADVANCED',
      performedBy: user.participantId,
      details: `Level ${level} sequence advanced to prompt #${nextIdx} after submitting ${submittedPromptId}`,
      timestamp: Date.now(),
      targetId: submittedPromptId,
    });

    return updated;
  }

  /**
   * Update configurable target sentences per level (e.g. 1 per level = 3 total, or 2 = 6 total)
   */
  async updateTargetPerLevel(userId: string, targetPerLevel: number): Promise<ParticipantProgress> {
    const user = await dbService.getUserById(userId);
    if (!user) throw new Error('User not found.');

    const progress = await this.getOrCreateProgress(user);
    const updated: ParticipantProgress = {
      ...progress,
      targetPerLevel: Math.max(1, Math.min(10, targetPerLevel)),
      lastUpdated: Date.now(),
    };

    await dbService.saveParticipantProgress(updated);
    return updated;
  }
}

export const progressService = new ProgressService();
