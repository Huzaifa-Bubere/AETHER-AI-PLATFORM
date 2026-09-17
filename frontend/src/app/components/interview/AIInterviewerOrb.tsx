import { useMemo } from 'react';
import type { InterviewerState } from '../../features/interview/useInterviewVoice';

/**
 * AETHER AI interviewer orb — professional, state-driven animation.
 * CSS-only (no 3D libs), GPU-friendly transforms, respects prefers-reduced-motion.
 * States: IDLE (breathing) · THINKING (rotating ring + dots) · SPEAKING (waveform + glow)
 *         LISTENING (mic ring pulse) · PROCESSING (progress sweep) · COMPLETE (steady)
 */
export function AIInterviewerOrb({ state, size = 220 }: { state: InterviewerState; size?: number }) {
  const statusText = useMemo(() => ({
    IDLE: 'Ready when you are',
    THINKING: 'Preparing next question…',
    SPEAKING: 'Speaking — please listen',
    LISTENING: 'Listening — your turn',
    PROCESSING: 'Analyzing your answer…',
    COMPLETE: 'Interview complete',
  }[state]), [state]);

  return (
    <div className="flex flex-col items-center gap-4" aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        {/* outer energy ring */}
        <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-700 ${
          state === 'SPEAKING' ? 'border-blue-300/70 orb-ring-pulse'
          : state === 'LISTENING' ? 'border-emerald-300/70 orb-ring-listening'
          : state === 'PROCESSING' ? 'border-indigo-300/70 orb-ring-pulse'
          : 'border-slate-200'
        }`} />
        {/* rotating particles while thinking */}
        {state === 'THINKING' && (
          <div className="absolute inset-2 orb-spin">
            <span className="absolute top-0 left-1/2 w-1.5 h-1.5 -ml-0.75 rounded-full bg-indigo-400" />
            <span className="absolute bottom-1 left-4 w-1 h-1 rounded-full bg-blue-400" />
            <span className="absolute bottom-1 right-4 w-1 h-1 rounded-full bg-violet-400" />
          </div>
        )}
        {/* core orb */}
        <div className={`absolute inset-6 rounded-full orb-gradient ${
          state === 'SPEAKING' ? 'orb-glow-speaking'
          : state === 'LISTENING' ? 'orb-glow-listening'
          : state === 'THINKING' || state === 'PROCESSING' ? 'orb-glow-thinking'
          : 'orb-breathe'
        } flex items-center justify-center`}>
          <span className="text-white text-xl font-bold tracking-widest select-none">AI</span>
        </div>
        {/* waveform while speaking */}
        {state === 'SPEAKING' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-1 h-6" aria-hidden="true">
            {[0, 1, 2, 3, 4].map(i => (
              <span key={i} className="w-1 rounded-full bg-blue-500 orb-wave" style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}
        {/* processing dots */}
        {state === 'PROCESSING' && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500 orb-dot" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-slate-600 min-h-5 text-center">{statusText}</p>
      <style>{ORB_CSS}</style>
    </div>
  );
}

const ORB_CSS = `
  .orb-gradient { background: linear-gradient(135deg, #2563EB 0%, #4F46E5 100%); }
  .orb-breathe { animation: orbBreathe 4.5s ease-in-out infinite; }
  .orb-glow-speaking { animation: orbGlowSpeaking 1.2s ease-in-out infinite; box-shadow: 0 0 40px 6px rgba(37,99,235,0.45); }
  .orb-glow-listening { box-shadow: 0 0 26px 4px rgba(22,163,74,0.35); }
  .orb-glow-thinking { animation: orbGlowThinking 2s ease-in-out infinite; }
  .orb-ring-pulse { animation: orbRingPulse 1.6s ease-out infinite; }
  .orb-ring-listening { animation: orbRingPulse 2.2s ease-out infinite; border-color: rgba(16,185,129,0.5); }
  .orb-spin { animation: orbSpin 3.2s linear infinite; }
  .orb-wave { animation: orbWave 0.9s ease-in-out infinite; height: 8px; }
  .orb-dot { animation: orbDot 1.1s ease-in-out infinite; }
  @keyframes orbBreathe { 0%,100% { transform: scale(1); box-shadow: 0 0 18px 2px rgba(37,99,235,0.18); } 50% { transform: scale(1.035); box-shadow: 0 0 30px 5px rgba(37,99,235,0.28); } }
  @keyframes orbGlowSpeaking { 0%,100% { box-shadow: 0 0 30px 4px rgba(37,99,235,0.4); } 50% { box-shadow: 0 0 52px 10px rgba(79,70,229,0.55); } }
  @keyframes orbGlowThinking { 0%,100% { box-shadow: 0 0 20px 3px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 34px 6px rgba(99,102,241,0.45); } }
  @keyframes orbRingPulse { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(1.12); opacity: 0.25; } }
  @keyframes orbSpin { to { transform: rotate(360deg); } }
  @keyframes orbWave { 0%,100% { height: 8px; } 50% { height: 24px; } }
  @keyframes orbDot { 0%,100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
  @media (prefers-reduced-motion: reduce) {
    .orb-breathe, .orb-glow-speaking, .orb-glow-thinking, .orb-ring-pulse,
    .orb-ring-listening, .orb-spin, .orb-wave, .orb-dot { animation: none !important; }
  }
`;
