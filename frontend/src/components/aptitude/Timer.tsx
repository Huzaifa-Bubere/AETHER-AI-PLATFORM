import { useEffect, useRef, useState } from 'react';

interface TimerProps {
  deadline: Date;
  onExpire: () => void;
}

export default function Timer({ deadline, onExpire }: TimerProps) {
  const [remainingMs, setRemainingMs] = useState(deadline.getTime() - Date.now());
  const hasExpired = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = deadline.getTime() - Date.now();
      setRemainingMs(ms);
      if (ms <= 0 && !hasExpired.current) {
        hasExpired.current = true;
        clearInterval(interval);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isCritical = totalSeconds <= 300; // last 5 minutes

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-lg font-semibold tabular-nums ${
        isCritical ? 'bg-red-50 text-destructive animate-pulse' : 'bg-secondary text-foreground'
      }`}
      role="timer"
      aria-live="polite"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" />
      </svg>
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}