/**
 * Formatting utilities for ReVoice Audio IDs, audio timecodes, and data sizes.
 */

/**
 * Standardized sentence display identifier: L1_S01, L2_S05, L3_S10
 */
export function formatSentenceId(level: number, sentenceNumber: number, promptId?: string): string {
  if (promptId) return promptId;
  const paddedNum = sentenceNumber.toString().padStart(2, '0');
  return `L${level}_S${paddedNum}`;
}

/**
 * Format duration in mm:ss.s or mm:ss
 */
export function formatDuration(seconds: number, includeTenths = true): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);

  const mStr = mins.toString().padStart(2, '0');
  const sStr = secs.toString().padStart(2, '0');

  if (includeTenths) {
    return `${mStr}:${sStr}.${tenths}`;
  }
  return `${mStr}:${sStr}`;
}

/**
 * Format file size into readable KB / MB
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format timestamp into readable localized date and time
 */
export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Builds canonical speech corpus recording ID formatted as:
 * REC_<speaker_id without underscores>_<prompt_id without underscores>
 *
 * Examples:
 *   speakerId: "SPK_0001", promptId: "L1_S01" -> "REC_SPK0001_L1S01"
 *   speakerId: "SPK_0002", promptId: "L1_S01" -> "REC_SPK0002_L1S01"
 *   speakerId: "SIM_0001", promptId: "L1_S01" -> "REC_SIM0001_L1S01"
 *   speakerId: "SIM_0001", promptId: "L3_S01" -> "REC_SIM0001_L3S01"
 *   speakerId: "SIM_0003", promptId: "L2_S01" -> "REC_SIM0003_L2S01"
 */
export function buildRecordingId(speakerId: string, promptId: string): string {
  const cleanSpeaker = (speakerId || 'SPK0001').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanPrompt = (promptId || 'L1S01').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `REC_${cleanSpeaker}_${cleanPrompt}`;
}
