import { Request, Response } from 'express';
import { body, param } from 'express-validator';
import IntegrityEvent, {
  IIntegrityEvent, IntegrityEventType, IntegrityModule, IntegritySeverity, MAX_INTEGRITY_WARNINGS,
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
  'GAZE_AWAY', 'HEAD_AWAY', 'MEDIA_TRACK_ENDED',
];

/** Events that together represent "the candidate left the assessment view". */
const LEAVE_EVENTS: IntegrityEventType[] = ['TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT'];
/** A single leave action may fire blur + visibilitychange + fullscreenchange almost together. */
const DEDUP_WINDOW_MS = 1500;

/**
 * Sustained camera-observation events (spec §15).
 *
 * The client-side rules engine already coalesces a whole incident into one
 * event, but the backend must never trust that (spec §30). A cooldown here means
 * a buggy or hostile client sending GAZE_AWAY every frame still produces one
 * warning, and it matches the engine's own 10s gaze cooldown.
 */
const CAMERA_OBSERVATION_EVENTS: IntegrityEventType[] = [
  'FACE_NOT_VISIBLE', 'MULTIPLE_FACES', 'GAZE_AWAY', 'HEAD_AWAY',
];
const CAMERA_OBSERVATION_COOLDOWN_MS = 10_000;

/** Events that are not a warning at all — recorded but never counted (spec §21). */
const NON_WARNING_SEVERITIES: IntegritySeverity[] = ['OBSERVATION'];

function parseSeverity(raw: unknown): IntegritySeverity {
  return raw === 'OBSERVATION' || raw === 'CRITICAL' || raw === 'WARNING' ? raw : 'WARNING';
}

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
    metadata?: Record<string, unknown>,
    timing: { severity?: unknown; startedAt?: unknown; endedAt?: unknown; durationMs?: unknown } = {},
  ): Promise<{ warningCount: number; maximumWarnings: number; shouldAutoSubmit: boolean; deduped: boolean; severity: IntegritySeverity }> {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const severity = parseSeverity(timing.severity);

    // ── Dedup 1: leave events within the window collapse into one warning ──
    if (LEAVE_EVENTS.includes(type)) {
      const recent = await IntegrityEvent.findOne({
        userId, module, attemptId,
        type: { $in: LEAVE_EVENTS },
        timestamp: { $gte: since },
      }).lean();
      if (recent) {
        return { ...(await this.state(module, attemptId, userId, true)), severity };
      }
    }

    // An OBSERVATION is informational: recorded for the report, never counted
    // against the warning budget (spec §21). It is also not deduplicated, because
    // the engine only emits one per incident anyway.
    if (NON_WARNING_SEVERITIES.includes(severity)) {
      await IntegrityEvent.create({
        userId, module, attemptId, type,
        warningNumber: 0,
        metadata: sanitizeMetadata(metadata),
        startedAt: toDate(timing.startedAt) ?? new Date(),
        endedAt: toDate(timing.endedAt),
        durationMs: Math.max(0, Number(timing.durationMs) || 0),
        severity,
        warningIssued: false,
      });
      return { ...(await this.state(module, attemptId, userId, false)), severity };
    }

    // Camera/mic events require a state transition. A sustained camera observation
    // may only re-warn after its cooldown (see CAMERA_OBSERVATION_EVENTS).
    if (CAMERA_OBSERVATION_EVENTS.includes(type)) {
      const recent = await IntegrityEvent.findOne({
        userId, module, attemptId, type,
        timestamp: { $gte: new Date(Date.now() - CAMERA_OBSERVATION_COOLDOWN_MS) },
      }).lean();
      if (recent) {
        return { ...(await this.state(module, attemptId, userId, true)), severity };
      }
    }

    if (type === 'CAMERA_DISABLED' || type === 'CAMERA_PERMISSION_REVOKED' || type === 'MEDIA_TRACK_ENDED' || type === 'MICROPHONE_DISABLED') {
      const recent = await IntegrityEvent.findOne({
        userId, module, attemptId, type,
        timestamp: { $gte: new Date(Date.now() - 30_000) },
      }).lean();
      if (recent) {
        return { ...(await this.state(module, attemptId, userId, true)), severity };
      }
    }

    // warningNumber is 1-based and counts WARNINGS only, so an OBSERVATION row
    // (which never increments) cannot make the numbering skip.
    const warningCount = (await IntegrityEvent.countDocuments({ module, attemptId, warningNumber: { $gte: 1 } })) + 1;
    await IntegrityEvent.create({
      userId, module, attemptId, type,
      warningNumber: warningCount,
      metadata: sanitizeMetadata(metadata),
      startedAt: toDate(timing.startedAt) ?? new Date(),
      endedAt: toDate(timing.endedAt),
      durationMs: Math.max(0, Number(timing.durationMs) || 0),
      severity,
      warningIssued: true,
    });

    return { ...(await this.state(module, attemptId, userId, false)), severity };
  }

  /** Authoritative warning state for an attempt. */
  async state(module: IntegrityModule, attemptId: string, userId: string, deduped = true) {
    // Only counted warnings (warningNumber >= 1) drive the limit; observations
    // are shown but must not end an assessment (spec §21).
    const warningCount = await IntegrityEvent.countDocuments({ module, attemptId, warningNumber: { $gte: 1 } });
    return {
      warningCount,
      maximumWarnings: MAX_INTEGRITY_WARNINGS,
      shouldAutoSubmit: warningCount >= MAX_INTEGRITY_WARNINGS,
      deduped,
    };
  }

  /** Full event log for result pages / admin. */
  async events(module: IntegrityModule, attemptId: string) {
    return IntegrityEvent.find({ module, attemptId })
      .sort({ timestamp: 1 })
      .select('type timestamp warningNumber severity durationMs metadata')
      .lean();
  }

  /**
   * Summary for result pages (spec §27).
   *
   * Worded as "observed integrity events" — never "cheating detected" — and it
   * groups by behaviour type so a report can say "1 prolonged attention
   * deviation" instead of listing raw rows.
   */
  async summary(module: IntegrityModule, attemptId: string) {
    const events = await this.events(module, attemptId);
    const warnings = events.filter((e: any) => Number(e.warningNumber) >= 1);
    const observations = events.filter((e: any) => Number(e.warningNumber) < 1);
    const countOf = (types: IntegrityEventType[]) =>
      events.filter((e: any) => types.includes(e.type)).length;
    const warningCount = warnings.length;
    return {
      warningCount,
      observationCount: observations.length,
      maximumWarnings: MAX_INTEGRITY_WARNINGS,
      status: warningCount >= MAX_INTEGRITY_WARNINGS ? 'terminated' : warningCount > 0 ? 'warning' : 'clean',
      autoSubmitted: warningCount >= MAX_INTEGRITY_WARNINGS,
      /** Observable evidence, grouped for display. Not proof of misconduct. */
      observed: {
        attentionDeviations: countOf(['GAZE_AWAY', 'HEAD_AWAY']),
        faceNotVisible: countOf(['FACE_NOT_VISIBLE']),
        multipleFaces: countOf(['MULTIPLE_FACES']),
        cameraInterruptions: countOf(['CAMERA_DISABLED', 'CAMERA_PERMISSION_REVOKED', 'MEDIA_TRACK_ENDED']),
        tabSwitches: countOf(['TAB_SWITCH']),
        windowBlur: countOf(['WINDOW_BLUR']),
        fullscreenExits: countOf(['FULLSCREEN_EXIT']),
      },
      events: events.map((e: any) => ({
        type: e.type,
        timestamp: e.timestamp,
        warningNumber: e.warningNumber,
        severity: e.severity ?? 'WARNING',
        durationMs: e.durationMs ?? 0,
      })),
    };
  }
}

function toDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
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
      const { module, attemptId, type, metadata, severity, startedAt, endedAt, durationMs } = req.body as {
        module: IntegrityModule; attemptId: string; type: IntegrityEventType; metadata?: Record<string, unknown>;
        severity?: string; startedAt?: string; endedAt?: string | null; durationMs?: number;
      };

      if (!MODULES.includes(module)) return res.status(400).json({ success: false, message: `Unsupported module: ${module}` });
      if (!EVENT_TYPES.includes(type)) return res.status(400).json({ success: false, message: `Unsupported event type: ${type}` });
      if (!attemptId || typeof attemptId !== 'string' || attemptId.length > 64) {
        return res.status(400).json({ success: false, message: 'attemptId is required' });
      }

      const state = await integrityService.recordEvent(userId, module, attemptId, type, metadata, {
        severity, startedAt, endedAt, durationMs,
      });

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
          severity: state.severity,
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
    body('severity').optional().isIn(['OBSERVATION', 'WARNING', 'CRITICAL']),
    body('startedAt').optional().isISO8601(),
    body('endedAt').optional({ nullable: true }).isISO8601(),
    // Bounded so a client cannot record an absurd incident duration.
    body('durationMs').optional().isInt({ min: 0, max: 86_400_000 }),
  ],
  asyncHandler((req, res) => integrityController.recordEvent(req, res))
);

router.get(
  '/:module/:attemptId',
  [param('module').isIn(MODULES), param('attemptId').isString().trim().notEmpty()],
  asyncHandler((req, res) => integrityController.getSummary(req, res))
);

export default router;
