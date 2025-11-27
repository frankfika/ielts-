import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  duration: number; // in seconds
  onComplete: () => void;
  label: string;
}

const Timer: React.FC<TimerProps> = ({ duration, onComplete, label }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete();
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, onComplete]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isUrgent = timeLeft < 10;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${isUrgent ? 'border-red-500 bg-red-900/20 text-red-400' : 'border-slate-600 bg-slate-800 text-slate-200'}`}>
      <Clock size={18} />
      <span className="text-sm font-semibold uppercase tracking-wider">{label}:</span>
      <span className="font-mono text-xl">{formatTime(timeLeft)}</span>
    </div>
  );
};

export default Timer;