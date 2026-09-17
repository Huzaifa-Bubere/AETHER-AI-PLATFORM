import { Request, Response } from 'express';
import { body, param } from 'express-validator';
import IntegrityEvent, {
  IIntegrityEvent, IntegrityEventType, IntegrityModule, MAX_INTEGRITY_WARNINGS,
} from '../models/IntegrityEvent';

/**
 * AETHER — shared Assessment Integrity backend.
 * Backend is AUTHORITATIVE: it owns the warning count and deduplication.
 * Frontend only reports observable events; it never dictates warnings.
 */

const MODULES: IntegrityModule[] = ['APTITUDE', 'TECHNICAL_MCQ', 'CODING', 'INTERVIEW'];

const EVENT_TYPES: IntegrityEventType[] = [
  'TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'COPY_ATTEMPT', 'PASTE_ATTEMPT',
  'CONTEXT_MENU', 'CAMERA_DISABLED', 'CAMERA_PERMISSION_REVOKED', 'FACE_NOT_VISIBLE',
  'MULTIPLE_FACES', 'MICROPHONE_DISABLED', 'PAGE_RELOAD_ATTEMPT',
];

/** Events that together represent "the candidate left the assessment view". */
const LEAVE_EVENTS: IntegrityEventType[] = ['TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT'];
/** A single leave action may fire blur + visibilitychange + fullscreenchange almost together. */
const DEDUP_WINDOW_MS = 1500;

class IntegrityService {
  /**
   * Record one observable event. Deduplicates near-simultaneous leave events and
   * camera state-machine repeats (no repeated FACE_NOT_VISIBLE until face returns).
   * Returns the authoritative warning state. The warning limit is 5; the fifth
   * warning returns shouldAutoSubmit so the module flow submits the assessment.
   */
  async recordEvent(
    userId: string,
    module: IntegrityModule,
    attemptId: string,
    type: IntegrityEventType,
    metadata?: Record<string, unknown>
  ): Promise<{ warningCount: number; maximumWarnings: number; shouldAutoSubmit: boolean; deduped: boolean }> {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS);

    // ── Dedup 1: leave events within the window collapse into one warning ──
    if (LEAVE_EVENTS.includes(type)) {
      const recent = await IntegrityEvent.findOne({
        userId, module, attemptId,
        type: { $in: LEAVE_EVENTS },
        timestamp: { $gte: since },
      }).lean();
      if (recent) {
        return this.state(module, attemptId, userId, true);
      }
    }

    // Camera/mic events require a state transition. FACE_NOT_VISIBLE may only
    // re-warn after the face was seen again — approximated by requiring no
    // FACE_NOT_VISIBLE warning within a longer window (5s threshold is enforced
    // client-side; here we just avoid per-frame spam).
    if (type === 'FACE_NOT_VISIBLE' || type === 'MULTIPLE_FACES' || type === 'CAMERA_DISABLED' || type === 'MICROPHONE_DISABLED') {
      const recent = await IntegrityEvent.findOne({
        userId, module, attemptId, type,
        timestamp: { $gte: new Date(Date.now() - 30_000) },
      }).lean();
      if (recent) {
        return this.state(module, attemptId, userId, true);
      }
    }

    const warningCount = (await IntegrityEvent.countDocuments({ module, attemptId })) + 1;
    await IntegrityEvent.create({
      userId, module, attemptId, type,
      warningNumber: warningCount,
      metadata: sanitizeMetadata(metadata),
    });

    return this.state(module, attemptId, userId, false);
  }

  /** Authoritative warning state for an attempt. */
  async state(module: IntegrityModule, attemptId: string, userId: string, deduped = true) {
    const warningCount = await IntegrityEvent.countDocuments({ module, attemptId });
    return {
      warningCount,
      maximumWarnings: MAX_INTEGRITY_WARNINGS,
      shouldAutoSubmit: warningCount >= MAX_INTEGRITY_WARNINGS,
      deduped,
    };
  }

  /** Full event log for result pages / admin. */
  async events(module: IntegrityModule, attemptId: string) {
    return IntegrityEvent.find({ module, attemptId }).sort({ timestamp: 1 }).select('type timestamp warningNumber').lean();
  }

  /** Summary for result pages: status + compact event list. */
  async summary(module: IntegrityModule, attemptId: string) {
    const events = await this.events(module, attemptId);
    const warningCount = events.length;
    return {
      warningCount,
      maximumWarnings: MAX_INTEGRITY_WARNINGS,
      status: warningCount >= MAX_INTEGRITY_WARNINGS ? 'terminated' : warningCount > 0 ? 'warning' : 'clean',
      autoSubmitted: warningCount >= MAX_INTEGRITY_WARNINGS,
      events: events.map(e => ({ type: e.type, timestamp: e.timestamp, warningNumber: e.warningNumber })),
    };
  }
}

function sanitizeMetadata(meta?: Record<string, unknown>): Record<string, unknown> {
  if (!meta) return {};
  // Keep small scalar metadata only — never store media or large payloads.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (['string', 'number', 'boolean'].includes(typeof v) && String(v).length <= 200) out[k] = v;
  }
  return out;
}

export const integrityService = new IntegrityService();

// ── Controller ───────────────────────────────────────────────────────────────

export class IntegrityController {
  /** POST /api/integrity/event */
  async recordEvent(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId as string;
      const { module, attemptId, type, metadata } = req.body as {
        module: IntegrityModule; attemptId: string; type: IntegrityEventType; metadata?: Record<string, unknown>;
      };

      if (!MODULES.includes(module)) return res.status(400).json({ success: false, message: `Unsupported module: ${module}` });
      if (!EVENT_TYPES.includes(type)) return res.status(400).json({ success: false, message: `Unsupported event type: ${type}` });
      if (!attemptId || typeof attemptId !== 'string' || attemptId.length > 64) {
        return res.status(400).json({ success: false, message: 'attemptId is required' });
      }

      const state = await integrityService.recordEvent(userId, module, attemptId, type, metadata);

      // At the limit the backend flags auto-submit; the module-specific completion
      // flow is driven by the frontend calling its own submit/end endpoint
      // (idempotent), while this flag is the authoritative trigger signal.
      // MAX_INTEGRITY_WARNINGS is 5 — five violations end the assessment.
      return res.json({
        success: true,
        data: {
          warningCount: state.warningCount,
          maximumWarnings: state.maximumWarnings,
          shouldAutoSubmit: state.shouldAutoSubmit,
          deduped: state.deduped,
          status: state.shouldAutoSubmit ? 'AUTO_SUBMITTED_INTEGRITY' : 'active',
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Failed to record integrity event' });
    }
  }

  /** GET /api/integrity/:module/:attemptId — summary for result pages */
  async getSummary(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId as string;
      const { module, attemptId } = req.params as { module: IntegrityModule; attemptId: string };
      if (!MODULES.includes(module as IntegrityModule)) {
        return res.status(400).json({ success: false, message: 'Unsupported module' });
      }
      const summary = await integrityService.summary(module as IntegrityModule, attemptId);
      // Verify the requester owns the attempt's events.
      const owned = await IntegrityEvent.exists({ module, attemptId, userId });
      if (!owned && summary.warningCount > 0) {
        return res.status(404).json({ success: false, message: 'No integrity data for this attempt' });
      }
      return res.json({ success: true, data: summary });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Failed to load integrity summary' });
    }
  }
}

export const integrityController = new IntegrityController();

// ── Routes ───────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post(
  '/event',
  [
    body('module').isIn(MODULES).withMessage('module must be APTITUDE, TECHNICAL_MCQ, CODING or INTERVIEW'),
    body('attemptId').isString().trim().notEmpty().isLength({ max: 64 }),
    body('type').isString().notEmpty(),
    body('metadata').optional().isObject(),
  ],
  asyncHandler((req, res) => integrityController.recordEvent(req, res))
);

router.get(
  '/:module/:attemptId',
  [param('module').isIn(MODULES), param('attemptId').isString().trim().notEmpty()],
  asyncHandler((req, res) => integrityController.getSummary(req, res))
);

export default router;
