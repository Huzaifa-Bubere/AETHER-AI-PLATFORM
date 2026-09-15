import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';

export interface ProctoringState {
  isFullscreen: boolean;
  strikes: number;
  maxStrikes: number;
  isFlagged: boolean;
  warningModalOpen: boolean;
  warningMessage: string;
  violations: Array<{
    type: string;
    timestamp: Date;
    description: string;
  }>;
}

export function useProctoring(interviewId: string | null, enabled: boolean = true) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [isFlagged, setIsFlagged] = useState(false);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [violations, setViolations] = useState<Array<{ type: string; timestamp: Date; description: string }>>([]);

  const maxStrikes = 4;
  const lastViolationTime = useRef<number>(0);

  // Send violation to backend API
  const reportViolation = useCallback(async (type: string, description: string) => {
    // Debounce duplicate events within 1.5 seconds
    const now = Date.now();
    if (now - lastViolationTime.current < 1500) return;
    lastViolationTime.current = now;

    const newViolation = { type, timestamp: new Date(), description };
    setViolations(prev => [...prev, newViolation]);

    setStrikes(prev => {
      const nextStrike = prev + 1;
      const flagged = nextStrike >= maxStrikes;
      if (flagged) setIsFlagged(true);

      const msg = flagged
        ? `STRIKE ${nextStrike}/${maxStrikes} (CRITICAL): Maximum cheating violations reached. Your assessment has been flagged for review.`
        : `STRIKE ${nextStrike}/${maxStrikes} WARNING: ${description}. Please stay in fullscreen and focus on your interview.`;

      setWarningMessage(msg);
      setWarningModalOpen(true);
      return nextStrike;
    });

    if (interviewId) {
      try {
        await apiService.post(`/interview/${interviewId}/proctor-event`, {
          type,
          description,
          severity: strikes >= 2 ? 'high' : 'medium',
        });
      } catch (err) {
        console.warn('Failed to sync proctor event with server:', err);
      }
    }
  }, [interviewId, strikes]);

  // Request fullscreen
  const requestFullscreen = useCallback(async () => {
    try {
      const docEl = document.documentElement;
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if ((docEl as any).webkitRequestFullscreen) {
          await (docEl as any).webkitRequestFullscreen();
        }
      }
      setIsFullscreen(true);
    } catch {
      // User or browser may block initial request until gesture
    }
  }, []);

  // 1. Fullscreen change listener
  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        reportViolation('fullscreen_exit', 'Exited fullscreen mode');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [enabled, reportViolation]);

  // 2. Visibility & Tab switch listener
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation('tab_switch', 'Tab switched or browser minimized');
      }
    };

    const handleWindowBlur = () => {
      // If fullscreen is active, losing focus usually means opening an overlay/app
      if (document.fullscreenElement) {
        reportViolation('window_blur', 'Window focus lost to external application');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [enabled, reportViolation]);

  // 3. Clipboard & Context Menu restrictions
  useEffect(() => {
    if (!enabled) return;

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error('Copying is strictly prohibited during the interview!', { id: 'proctor-copy' });
      reportViolation('copy_paste_attempt', 'Attempted to copy content');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error('Pasting external answers is disabled to ensure fairness!', { id: 'proctor-paste' });
      reportViolation('copy_paste_attempt', 'Attempted to paste external content');
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error('Clipboard actions are prohibited!', { id: 'proctor-cut' });
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast('Right-click context menu is locked during proctored sessions.', {
        icon: '🔒',
        id: 'proctor-context',
      });
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [enabled, reportViolation]);

  const closeWarningModal = useCallback(() => {
    setWarningModalOpen(false);
    // Automatically re-request fullscreen when acknowledging warning
    if (!document.fullscreenElement) {
      requestFullscreen();
    }
  }, [requestFullscreen]);

  return {
    isFullscreen,
    strikes,
    maxStrikes,
    isFlagged,
    violations,
    warningModalOpen,
    warningMessage,
    requestFullscreen,
    closeWarningModal,
  };
}
