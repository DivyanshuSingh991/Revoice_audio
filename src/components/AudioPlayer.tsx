import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import { formatDuration } from '../utils/formatters';

interface AudioPlayerProps {
  audioUrl?: string | null;
  audioBlob?: Blob | null;
  onEnded?: () => void;
  showDetails?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  audioBlob,
  onEnded,
  showDetails = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let url: string | null = null;
    if (audioBlob) {
      url = URL.createObjectURL(audioBlob);
      setResolvedUrl(url);
    } else if (audioUrl) {
      setResolvedUrl(audioUrl);
    }

    return () => {
      if (audioBlob && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [audioBlob, audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((e) => {
        console.error('Audio play error:', e);
        setIsPlaying(false);
      });
    }
  };

  const restart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    audio.play().then(() => setIsPlaying(true)).catch(console.error);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <div className="w-full rounded-2xl bg-teal-50/50 p-4 border border-teal-100/90 shadow-xs">
      {resolvedUrl && (
        <audio
          ref={audioRef}
          src={resolvedUrl}
          preload="auto"
          playsInline
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration || 0);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
            }
            setCurrentTime(0);
            if (onEnded) onEnded();
          }}
        />
      )}

      {/* Progress Scrubber */}
      <div className="flex flex-col gap-1.5">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Audio scrubber"
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-none"
        />
        <div className="flex items-center justify-between text-xs font-mono text-slate-500">
          <span className="font-semibold text-teal-800">{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!resolvedUrl}
            className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition active:scale-95 shadow-md ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                : 'bg-gradient-to-tr from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white shadow-teal-600/25'
            }`}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={restart}
            disabled={!resolvedUrl}
            className="min-h-[40px] min-w-[40px] rounded-xl text-slate-500 hover:text-slate-800 hover:bg-teal-100/60 flex items-center justify-center transition active:scale-95 border border-slate-200/50"
            aria-label="Restart audio from beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {showDetails && (
          <div className="flex items-center gap-1.5 text-xs text-teal-700 font-medium">
            <Volume2 className="w-4 h-4 text-teal-600" />
            <span>ReVoice Audio Preview</span>
          </div>
        )}
      </div>
    </div>
  );
};
