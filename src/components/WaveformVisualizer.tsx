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
    // Generate more realistic waveform data
    const bars = 180;
    const data: number[] = [];
    
    // Create a wave-like pattern that looks more like actual audio
    for (let i = 0; i < bars; i++) {
      const position = i / bars;
      // Create peaks and valleys that look more natural
      const wave1 = Math.sin(position * Math.PI * 8) * 0.3;
      const wave2 = Math.sin(position * Math.PI * 3) * 0.2;
      const randomness = Math.random() * 0.2;
      const baseHeight = 0.4;
      
      const value = Math.abs(baseHeight + wave1 + wave2 + randomness);
      data.push(Math.min(value, 1));
    }
    
    setWaveformData(data);
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);

    const barWidth = rect.width / waveformData.length;
    const centerY = rect.height / 2;

    ctx.clearRect(0, 0, rect.width, rect.height);

    waveformData.forEach((value, index) => {
      const barHeight = value * rect.height * 0.8;
      const x = index * barWidth;
      const progressPosition = progress * waveformData.length;

      // Color based on whether this bar has been played
      if (index < progressPosition) {
        ctx.fillStyle = "hsl(var(--primary))";
      } else {
        ctx.fillStyle = "hsl(var(--muted-foreground) / 0.3)";
      }

      ctx.fillRect(
        x,
        centerY - barHeight / 2,
        Math.max(barWidth * 0.8, 1),
        barHeight
      );
    });
  }, [waveformData, progress, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("w-full h-full", className)}
      style={{ width: "100%", height: "100%" }}
    />
  );
};
