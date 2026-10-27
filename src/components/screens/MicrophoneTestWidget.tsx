import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, CheckCircle2, AlertTriangle, RefreshCw, Volume2 } from 'lucide-react';

export const MicrophoneTestWidget: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [testStatus, setTestStatus] = useState<'idle' | 'recording' | 'completed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllStreams();
      if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
    };
  }, [testAudioUrl]);

  const stopAllStreams = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const startMicTest = async () => {
    setErrorMessage(null);
    setTestStatus('recording');
    setTesting(true);
    audioChunksRef.current = [];

    if (testAudioUrl) {
      URL.revokeObjectURL(testAudioUrl);
      setTestAudioUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      // Audio level analyser
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      // Recorder for a short 3.5s sound check
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setTestAudioUrl(url);
        setTestStatus('completed');
        setTesting(false);
        stopAllStreams();
      };

      recorder.start();

      // Automatically stop after 3.5 seconds
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 3500);
    } catch (err: unknown) {
      stopAllStreams();
      setTesting(false);
      setTestStatus('error');
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Could not access microphone. Please allow microphone permissions.');
      }
    }
  };

  const handlePlayTestAudio = () => {
    if (!testAudioUrl) return;
    if (isPlayingTest && audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlayingTest(false);
      return;
    }

    if (!audioElementRef.current) {
      audioElementRef.current = new Audio(testAudioUrl);
      audioElementRef.current.onended = () => setIsPlayingTest(false);
    } else {
      audioElementRef.current.src = testAudioUrl;
    }

    audioElementRef.current.play().then(() => setIsPlayingTest(true)).catch(() => {});
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-600 shrink-0">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Microphone Audio Check
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                16kHz Speech Input
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify your microphone volume and clarity before recording speech corpus sentences.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {!testing ? (
            <button
              type="button"
              onClick={startMicTest}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{testStatus === 'completed' ? 'Retest Mic' : 'Test Microphone'}</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Speak now (3s check)...</span>
            </div>
          )}

          {testAudioUrl && !testing && (
            <button
              type="button"
              onClick={handlePlayTestAudio}
              className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 border border-teal-200"
            >
              {isPlayingTest ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlayingTest ? 'Pause' : 'Play Soundcheck'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Input Meter */}
      {testing && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Input Signal Level:</span>
            <span className="font-mono">{micLevel}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${
                micLevel > 20 ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-slate-300'
              }`}
              style={{ width: `${micLevel}%` }}
            />
          </div>
        </div>
      )}

      {/* Completed feedback */}
      {testStatus === 'completed' && !testing && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">Microphone signal detected and ready for recording.</span>
          </div>
        </div>
      )}

      {/* Error notification */}
      {errorMessage && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-2 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
