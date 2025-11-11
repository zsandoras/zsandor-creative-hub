import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface WaveformVisualizerProps {
  audioUrl?: string;
  isPlaying?: boolean;
  progress?: number;
  className?: string;
}

export const WaveformVisualizer = ({ 
  audioUrl, 
  isPlaying = false, 
  progress = 0,
  className 
}: WaveformVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  useEffect(() => {
    if (!audioUrl) {
      setWaveformData([]);
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const analyze = async () => {
      try {
        const res = await fetch(audioUrl, { signal: controller.signal });
        const arrayBuffer = await res.arrayBuffer();
        const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
        const audioCtx = new AudioCtx();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

        const channels: Float32Array[] = [];
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          channels.push(audioBuffer.getChannelData(ch));
        }

        const totalSamples = audioBuffer.length;
        const seconds = Math.max(1, Math.round(audioBuffer.duration));
        // One bar per second, capped to keep rendering light
        const bars = Math.min(600, Math.max(60, seconds));
        const samplesPerBar = Math.max(1, Math.floor(totalSamples / bars));
        const peaks: number[] = [];

        for (let i = 0; i < bars; i++) {
          const start = i * samplesPerBar;
          const end = Math.min((i + 1) * samplesPerBar, totalSamples);
          let peak = 0;

          for (let ch = 0; ch < channels.length; ch++) {
            const data = channels[ch];
            for (let s = start; s < end; s += 64) {
              const v = Math.abs(data[s]);
              if (v > peak) peak = v;
            }
          }

          peaks.push(Math.min(1, Math.sqrt(peak)));
        }

        if (!isCancelled) setWaveformData(peaks);
        audioCtx.close();
      } catch (err) {
        if (!isCancelled) {
          // Fallback simple shape if decode fails
          const bars = 180;
          const data: number[] = Array.from({ length: bars }, (_, i) => 0.3 + 0.2 * Math.sin((i / bars) * Math.PI * 4));
          setWaveformData(data.map((v) => Math.min(1, Math.abs(v))));
        }
      }
    };

    analyze();
    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Reset transform to avoid cumulative scaling on rerenders
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);

    const barWidth = rect.width / waveformData.length;
    const centerY = rect.height / 2;

    ctx.clearRect(0, 0, rect.width, rect.height);

    waveformData.forEach((value, index) => {
      const barHeight = value * rect.height * 0.8;
      const x = index * barWidth;
      const clampedProgress = Math.max(0, Math.min(1, Number.isFinite(progress as number) ? (progress as number) : 0));
      const progressPosition = Math.floor(clampedProgress * waveformData.length);

      // Base bars in foreground (white), overlay played in primary (orange)
      if (index < progressPosition) {
        const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary');
        ctx.fillStyle = primary ? `hsl(${primary})` : 'hsl(var(--primary))';
      } else {
        ctx.fillStyle = "hsl(var(--foreground) / 0.85)";
      }

      ctx.fillRect(
        x,
        centerY - barHeight / 2,
        Math.max(barWidth * 0.8, 1),
        barHeight
      );
    });
  }, [waveformData, progress, isPlaying]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioUrl || waveformData.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickProgress = x / rect.width;
    
    // Dispatch event to seek to this position
    window.dispatchEvent(new CustomEvent('seekToPosition', { 
      detail: { progress: Math.max(0, Math.min(1, clickProgress)) } 
    }));
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className={cn("w-full h-full cursor-pointer", className)}
      style={{ width: "100%", height: "100%" }}
    />
  );
};
