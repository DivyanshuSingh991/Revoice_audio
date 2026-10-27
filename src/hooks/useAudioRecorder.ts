import { useState, useRef, useEffect, useCallback } from 'react';

export type RecorderState =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'error';

export interface UseAudioRecorderReturn {
  state: RecorderState;
  duration: number; // in seconds
  error: string | null;
  analyserNode: AnalyserNode | null;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  resetError: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const timerIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Clean up all audio streams and nodes
  const cleanupStreams = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    audioChunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cleanupStreams();
    };
  }, [cleanupStreams]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    cleanupStreams();
    setError(null);
    setState('requesting_permission');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio recording is not supported by your browser or environment.');
      }

      // Request Android microphone permission with acoustic speech filters
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      // Handle stream interruption (e.g. phone call or background switch on Android)
      stream.getAudioTracks()[0].onended = () => {
        if (state === 'recording') {
          setError('Microphone stream was interrupted or disconnected.');
          cleanupStreams();
          setState('error');
        }
      };

      // Set up AudioContext & AnalyserNode for real-time waveform visualization
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Select supported audio mime type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        '',
      ];
      const selectedMime = mimeTypes.find((m) => m === '' || MediaRecorder.isTypeSupported(m)) || '';

      const recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100); // chunk every 100ms for responsiveness

      startTimeRef.current = Date.now();
      setDuration(0);
      setState('recording');

      // High-precision timer for duration display
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);
      }, 50);

      return true;
    } catch (err: unknown) {
      cleanupStreams();
      setState('error');

      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setError('Microphone access was denied. Please grant microphone permission in your Android settings to record speech.');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setError('No active microphone found on your device.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to initiate audio recording.');
      }
      return false;
    }
  }, [cleanupStreams, state]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanupStreams();
        setState('idle');
        resolve(null);
        return;
      }

      setState('processing');

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      const finalDuration = (Date.now() - startTimeRef.current) / 1000;
      setDuration(finalDuration);

      recorder.onstop = () => {
        const chunks = audioChunksRef.current;
        const mimeType = recorder.mimeType || 'audio/webm';
        const finalBlob = new Blob(chunks, { type: mimeType });

        cleanupStreams();
        setState('idle');

        if (finalBlob.size === 0) {
          setError('Recorded audio file is empty. Please try speaking into the microphone.');
          resolve(null);
        } else {
          resolve(finalBlob);
        }
      };

      try {
        recorder.stop();
      } catch (e) {
        cleanupStreams();
        setState('idle');
        resolve(null);
      }
    });
  }, [cleanupStreams]);

  const cancelRecording = useCallback(() => {
    cleanupStreams();
    setDuration(0);
    setState('idle');
  }, [cleanupStreams]);

  const resetError = useCallback(() => {
    setError(null);
    if (state === 'error') {
      setState('idle');
    }
  }, [state]);

  return {
    state,
    duration,
    error,
    analyserNode: analyserRef.current,
    startRecording,
    stopRecording,
    cancelRecording,
    resetError,
  };
}
