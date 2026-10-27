/**
 * Standardized 16-bit Linear PCM RIFF/WAV Audio Encoder
 *
 * Speech-processing standard:
 * - Format: RIFF WAVE
 * - Codec: Uncompressed Linear PCM (AudioFormat = 1)
 * - Bit Depth: 16-bit signed integers (Little-Endian)
 * - Channels: 1 (Mono)
 * - Standard Sample Rate: 16,000 Hz (Optimal for ASR & Speech Corpus ML models)
 */

/**
 * Write a string into a DataView at specified byte offset
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Encodes raw 32-bit float PCM audio samples into a 16-bit Linear PCM WAV Blob
 */
export function encodePcmWav(
  samples: Float32Array,
  sampleRate: number,
  channelCount = 1
): Blob {
  const bytesPerSample = 2; // 16-bit PCM = 2 bytes
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const bufferSize = 44 + dataSize; // 44-byte RIFF header + raw PCM data

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // 1. RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // chunkSize = 36 + SubChunk2Size
  writeString(view, 8, 'WAVE');

  // 2. "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size = 16 for PCM
  view.setUint16(20, 1, true); // AudioFormat = 1 (Linear PCM)
  view.setUint16(22, channelCount, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate (e.g. 16000)
  view.setUint32(28, byteRate, true); // ByteRate = SampleRate * NumChannels * BitsPerSample/8
  view.setUint16(32, blockAlign, true); // BlockAlign = NumChannels * BitsPerSample/8
  view.setUint16(34, 16, true); // BitsPerSample = 16

  // 3. "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size

  // 4. Write PCM 16-bit audio samples with soft clipping
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1.0, 1.0]
    const s = Math.max(-1, Math.min(1, samples[i]));
    // Scale to 16-bit signed integer range: -32768 to 32767
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, Math.floor(val), true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Converts any recorded Audio Blob into a standardized 16-bit Linear PCM WAV Blob
 * Standardizes to target sample rate (default 16000 Hz) and mono channel count.
 */
export async function convertBlobToWav(
  inputBlob: Blob,
  targetSampleRate = 16000
): Promise<{
  wavBlob: Blob;
  duration: number;
  sampleRate: number;
  channelCount: number;
  bitDepth: number;
}> {
  const arrayBuffer = await inputBlob.arrayBuffer();

  // Create an AudioContext to decode compressed formats (webm/opus, ogg, m4a, mp3)
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;

    // Resample to targetSampleRate using OfflineAudioContext for pristine fidelity
    const offlineCtx = new OfflineAudioContext(
      1, // 1 mono channel for speech processing
      Math.ceil(duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const monoSamples = renderedBuffer.getChannelData(0);

    const wavBlob = encodePcmWav(monoSamples, targetSampleRate, 1);

    return {
      wavBlob,
      duration,
      sampleRate: targetSampleRate,
      channelCount: 1,
      bitDepth: 16,
    };
  } finally {
    await audioCtx.close();
  }
}
