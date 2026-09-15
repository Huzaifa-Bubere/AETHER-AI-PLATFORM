import React from 'react';
import { ShieldAlert, ShieldCheck, Maximize2, AlertTriangle, Eye, Lock } from 'lucide-react';

interface ProctoringHUDProps {
  isFullscreen: boolean;
  strikes: number;
  maxStrikes: number;
  isFlagged: boolean;
  warningModalOpen: boolean;
  warningMessage: string;
  onRequestFullscreen: () => void;
  onAcknowledgeWarning: () => void;
}

export const ProctoringHUD: React.FC<ProctoringHUDProps> = ({
  isFullscreen,
  strikes,
  maxStrikes,
  isFlagged,
  warningModalOpen,
  warningMessage,
  onRequestFullscreen,
  onAcknowledgeWarning,
}) => {
  return (
    <>
      {/* Top Proctoring Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all border shadow-sm bg-white/90 text-slate-700 border-slate-200">
        <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>AI Proctor Active</span>
        </div>

        <span className="w-px h-3 bg-slate-300 mx-1" />

        {/* Fullscreen indicator */}
        <button
          onClick={onRequestFullscreen}
          title={isFullscreen ? 'Fullscreen active' : 'Click to enter fullscreen'}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors ${
            isFullscreen
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-300 animate-bounce cursor-pointer'
          }`}
        >
          <Maximize2 className="w-3 h-3" />
          <span>{isFullscreen ? 'Fullscreen' : 'Click Fullscreen'}</span>
        </button>

        {/* Anti-paste / Clipboard locked indicator */}
        <div className="hidden sm:flex items-center gap-1 text-slate-500 px-1.5 py-0.5 rounded bg-slate-100">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Anti-Copy</span>
        </div>

        {/* Tab tracking indicator */}
        <div className="hidden md:flex items-center gap-1 text-slate-500 px-1.5 py-0.5 rounded bg-slate-100">
          <Eye className="w-3 h-3 text-slate-400" />
          <span>Tab Monitored</span>
        </div>

        <span className="w-px h-3 bg-slate-300 mx-1" />

        {/* Strikes pill */}
        <div
          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold ${
            isFlagged || strikes >= 3
              ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse'
              : strikes > 0
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <ShieldAlert className="w-3 h-3" />
          <span>
            {strikes}/{maxStrikes} Strikes
          </span>
        </div>
      </div>

      {/* Proctoring Warning Modal */}
      {warningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 overflow-hidden text-slate-800 p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center border-4 border-rose-50 shadow-inner">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">
                {isFlagged ? 'Interview Integrity Flagged!' : 'Proctoring Warning'}
              </h3>
              <p className="text-sm font-medium text-rose-600">
                Strike {strikes} of {maxStrikes} recorded
              </p>
            </div>

            <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 leading-relaxed text-left">
              <p className="font-semibold mb-1">Violation Details:</p>
              <p>{warningMessage}</p>
            </div>

            <div className="text-xs text-slate-500 space-y-1 text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p className="font-semibold text-slate-700">Strict Anti-Cheating Rules:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                <li>Remain in full-screen at all times until submission.</li>
                <li>Do not switch tabs, minimize windows, or open other tools.</li>
                <li>External clipboard copy/pasting is strictly forbidden.</li>
                <li>4 strikes will result in an automatic flagging on your report.</li>
              </ul>
            </div>

            <button
              onClick={onAcknowledgeWarning}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 shadow-lg shadow-indigo-200 transition-transform active:scale-95"
            >
              I Understand — Return to Fullscreen
            </button>
          </div>
        </div>
      )}
    </>
  );
};
