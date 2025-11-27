import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  level: number; // 0 to 1
  color?: string;
  isActive: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ level, color = '#60a5fa', isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let currentHeight = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);
      
      // Smooth out the level
      const targetHeight = isActive ? Math.max(2, level * height * 0.8) : 2;
      currentHeight += (targetHeight - currentHeight) * 0.2;

      ctx.beginPath();
      ctx.moveTo(0, centerY);

      // Draw simple waveform
      for (let x = 0; x < width; x++) {
        // Sine wave effect combined with amplitude
        const wave = Math.sin(x * 0.1 + Date.now() * 0.01) * currentHeight;
        ctx.lineTo(x, centerY + wave);
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [level, color, isActive]);

  return <canvas ref={canvasRef} width={200} height={60} className="w-full h-full" />;
};

export default AudioVisualizer;