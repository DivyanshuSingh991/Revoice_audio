import React, { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  barColor?: string;
  height?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  analyserNode,
  isRecording,
  barColor = '#10b981',
  height = 72,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!isRecording || !analyserNode) {
      // Draw quiet standby baseline
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      const mid = canvas.height / 2;
      ctx.fillRect(0, mid - 1, canvas.width, 2);
      return;
    }

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 36;
      const barWidth = Math.floor(canvas.width / barCount) - 3;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        // Average sample over bin range
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j] || 0;
        }
        const avg = sum / step;
        const normalized = avg / 255; // 0.0 to 1.0

        // Minimum bar height for aesthetic presence
        const minHeight = 4;
        const barHeight = Math.max(minHeight, normalized * (canvas.height - 8));

        const x = i * (barWidth + 3);
        const y = (canvas.height - barHeight) / 2;

        // ReVoice Audio gradient: bright mint/teal to emerald
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#34d399');
        grad.addColorStop(0.5, '#10b981');
        grad.addColorStop(1, '#0d9488');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isRecording, barColor]);

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-slate-900 p-2.5 border border-teal-900/60 shadow-inner">
      <canvas
        ref={canvasRef}
        width={320}
        height={height}
        className="w-full block"
      />
    </div>
  );
};
