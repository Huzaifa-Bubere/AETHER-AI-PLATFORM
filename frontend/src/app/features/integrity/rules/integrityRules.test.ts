/**
 * AETHER — Interview Integrity Rules Engine tests (spec §33 fixtures + §34 cases).
 *
 * NO WEBCAM, NO MEDIAPIPE, NO NETWORK. Every case is a deterministic sequence of
 * timestamps, so the exact behaviour the candidate experiences is reproducible —
 * which matters because the alternative is "try it and see what the camera does".
 *
 * Fixture names mirror spec §33 so the mapping is obvious:
 *   CENTER · LEFT_SHORT · LEFT_LONG · NO_FACE_SHORT · NO_FACE_LONG · MULTIPLE_FACE
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IntegrityRulesEngine,
  DEFAULT_INTEGRITY_CONFIG,
  INTEGRITY_EVENT_COPY,
  INTEGRITY_EVENT_TYPES,
  buildCalibrationBaseline,
  classifySession,
  severityConsumesWarning,
  type FaceObservation,
  type IntegrityDecision,
} from './integrityRules';

const FPS = 10;
const STEP = 1000 / FPS;

/** Replay a sequence of observations and collect every emitted event. */
function run(engine: IntegrityRulesEngine, observations: FaceObservation[]) {
  const events: NonNullable<IntegrityDecision['event']>[] = [];
  let last: IntegrityDecision | null = null;
  for (const obs of observations) {
    last = engine.push(obs);
    if (last.event) events.push(last.event);
  }
  return { events, last: last as IntegrityDecision };
}

/** A face present and centred, with head pose and iris offset at the baseline. */
const center = (at: number): FaceObservation => ({
  at, facePresent: true, faceCount: 1, confidence: 0.95, yawDeg: 0, pitchDeg: 0, eyeOffsetX: 0, eyeOffsetY: 0,
});

function range(fromMs: number, toMs: number, make: (at: number) => FaceObservation): FaceObservation[] {
  const out: FaceObservation[] = [];
  for (let t = fromMs; t <= toMs; t += STEP) out.push(make(t));
  return out;
}

/** Baseline captured at 0°/0° — the neutral pose. */
const BASELINE = buildCalibrationBaseline(
  Array.from({ length: 20 }, () => ({ yawDeg: 0, pitchDeg: 0, eyeOffsetX: 0, eyeOffsetY: 0 })),
);

function engine(config = {}) {
  return new IntegrityRulesEngine(config, BASELINE);
}

// ── Calibration (spec §5) ───────────────────────────────────────────────────

test('calibration uses the median so one bad frame cannot skew the baseline', () => {
  const samples = [
    ...Array.from({ length: 9 }, () => ({ yawDeg: 2, pitchDeg: -1 })),
    { yawDeg: 88, pitchDeg: 70 }, // a tracking jump / head turn mid-calibration
  ];
  const baseline = buildCalibrationBaseline(samples);
  assert.equal(baseline.yawDeg, 2, 'a single outlier must not drag the neutral pose');
  assert.equal(baseline.pitchDeg, -1);
  assert.equal(baseline.sampleCount, 10);
});

test('an empty calibration set produces no baseline rather than a fake zero', () => {
  const baseline = buildCalibrationBaseline([]);
  assert.equal(baseline.sampleCount, 0);
  assert.equal(baseline.yawDeg, 0);
});

test('without calibration the engine refuses to judge instead of assuming', () => {
  const e = new IntegrityRulesEngine({}, null);
  const { events, last } = run(e, range(0, 8000, at => ({ ...center(at), yawDeg: 45 })));
  assert.equal(events.length, 0, 'looking away from an uncalibrated centre must not warn');
  assert.equal(last.debug.gaze, 'UNKNOWN');
});

test('setBaseline takes effect after construction', () => {
  const e = new IntegrityRulesEngine({}, null);
  e.setBaseline(BASELINE);
  const { last } = run(e, range(0, 500, center));
  assert.equal(last.debug.gaze, 'CENTER');
});

// ── §33 fixtures ────────────────────────────────────────────────────────────

test('CENTER: sitting normally produces zero warnings', () => {
  const { events, last } = run(engine(), range(0, 30_000, center));
  assert.equal(events.length, 0);
  assert.equal(last.classification, 'NORMAL');
  assert.equal(last.debug.gaze, 'CENTER');
});

test('LEFT_SHORT: looking away for 1 second produces NO warning', () => {
  const { events } = run(engine(), [
    ...range(0, 900, center),
    ...range(1000, 2000, at => ({ ...center(at), yawDeg: 45 })),
    ...range(2100, 3000, center),
  ]);
  assert.equal(events.length, 0, 'a brief natural glance must be ignored (spec §22 CASE A)');
});

test('LEFT_LONG: looking away for 5 seconds produces exactly ONE warning', () => {
  const { events } = run(engine(), [
    ...range(0, 500, center),
    ...range(600, 6000, at => ({ ...center(at), yawDeg: 45 })),
  ]);
  assert.equal(events.length, 1, 'one sustained incident = one warning');
  assert.equal(events[0].type, 'HEAD_AWAY');
  assert.equal(events[0].severity, 'WARNING');
  assert.equal(events[0].warningIssued, true);
  assert.ok(events[0].durationMs >= 4000, `expected >=4000ms sustained, got ${events[0].durationMs}`);
});

test('continuing to look away does not warn again every second (spec §18)', () => {
  const { events } = run(engine(), [
    ...range(0, 500, center),
    ...range(600, 20_000, at => ({ ...center(at), yawDeg: 45 })), // ~19s continuously away
  ]);
  assert.equal(events.length, 1, 'a single look-away must never emit repeated warnings');
});

test('NO_FACE_SHORT: tracking absent for 1 second produces NO warning', () => {
  const { events } = run(engine(), [
    ...range(0, 900, center),
    ...range(1000, 2000, at => ({ at, facePresent: false, faceCount: 0, confidence: 0 })),
  ]);
  assert.equal(events.length, 0, 'brief MediaPipe tracking loss is not misconduct (spec §10)');
});

test('mid-length face loss shows only a subtle indicator, not a warning', () => {
  const e = engine();
  const { events, last } = run(e, [
    ...range(0, 900, center),
    ...range(1000, 4000, at => ({ at, facePresent: false, faceCount: 0, confidence: 0 })),
  ]);
  assert.equal(events.length, 0, '2-5s is an observation window');
  assert.equal(last.indicator, 'Face visibility lost');
});

test('NO_FACE_LONG: face absent for 6 seconds produces exactly ONE warning', () => {
  const { events } = run(engine(), [
    ...range(0, 900, center),
    ...range(1000, 7000, at => ({ at, facePresent: false, faceCount: 0, confidence: 0 })),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'FACE_MISSING');
  assert.ok(events[0].durationMs >= 5000);
});

test('MULTIPLE_FACE: two faces for 3 seconds produces exactly ONE warning', () => {
  const { events } = run(engine(), [
    ...range(0, 500, center),
    ...range(600, 3600, at => ({ ...center(at), faceCount: 2 })),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'MULTIPLE_FACES');
  assert.equal(events[0].metadata.faceCount, 2);
});

test('a second person for less than the ignore window produces no warning', () => {
  const { events } = run(engine(), [
    ...range(0, 500, center),
    ...range(600, 1800, at => ({ ...center(at), faceCount: 2 })), // 1.2s
  ]);
  assert.equal(events.length, 0);
});

// ── Gaze vs head pose: two signals, combined (spec §9) ──────────────────────

test('eyes off-centre with a straight head is detected as GAZE_AWAY', () => {
  const { events } = run(engine(), [
    ...range(0, 500, center),
    ...range(600, 6000, at => ({ ...center(at), yawDeg: 0, eyeOffsetX: 0.3 })),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'GAZE_AWAY', 'head-only detection would miss this');
  assert.equal(events[0].metadata.gazeDirection, 'RIGHT');
});

test('head turned with centred eyes is detected as HEAD_AWAY', () => {
  const { events } = run(engine(), [
    ...range(0, 500, center),
    ...range(600, 6000, at => ({ ...center(at), yawDeg: -40 })),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'HEAD_AWAY');
  assert.equal(events[0].metadata.gazeDirection, 'LEFT');
});

test('a head turn just inside the threshold is not a warning', () => {
  const e = engine();
  const { events, last } = run(e, range(0, 8000, at => ({ ...center(at), yawDeg: 25 })));
  assert.equal(events.length, 0, '25° is below the 30° threshold');
  assert.equal(last.debug.gaze, 'CENTER');
});

test('pitch beyond the threshold is classified UP or DOWN', () => {
  const down = run(engine(), range(0, 6000, at => ({ ...center(at), pitchDeg: 30 })));
  assert.equal(down.last.debug.gaze, 'DOWN');
  const up = run(engine(), range(0, 6000, at => ({ ...center(at), pitchDeg: -30 })));
  assert.equal(up.last.debug.gaze, 'UP');
});

// ── Temporal smoothing (spec §7) ────────────────────────────────────────────

test('a single outlier frame does not trigger a warning', () => {
  const e = engine();
  const { events } = run(e, [
    ...range(0, 900, center),
    { ...center(1000), yawDeg: 60 }, // one jittery frame
    ...range(1100, 5000, center),
  ]);
  assert.equal(events.length, 0, 'median smoothing must absorb a one-frame spike');
});

test('brief track loss resets the smoothing window instead of averaging stale pose', () => {
  const e = engine();
  run(e, [ ...range(0, 300, center), ...range(400, 900, () => ({ at: 400, facePresent: false, faceCount: 0, confidence: 0 })) ]);
  const { last } = run(e, [center(1000)]);
  assert.equal(last.debug.smoothedYaw, 0);
});

// ── Low confidence / unknown (spec §23) ─────────────────────────────────────

test('low tracking confidence yields UNKNOWN and never a warning', () => {
  const { events, last } = run(engine(), range(0, 10_000, at => ({
    ...center(at), confidence: 0.2, yawDeg: 50,
  })));
  assert.equal(events.length, 0, 'do not accuse on a guess');
  assert.equal(last.debug.gaze, 'UNKNOWN');
  assert.equal(last.suppressed, 'LOW_CONFIDENCE');
});

test('missing landmarks for a face that IS present yields UNKNOWN', () => {
  const { events, last } = run(engine(), range(0, 8000, at => ({
    at, facePresent: true, faceCount: 1, confidence: 0.9, yawDeg: null, pitchDeg: null,
  })));
  assert.equal(events.length, 0);
  assert.equal(last.debug.gaze, 'UNKNOWN');
});

test('confidence recovering mid-incident resumes normal evaluation', () => {
  const e = engine();
  run(e, range(0, 1000, at => ({ ...center(at), confidence: 0.1 })));
  const { last } = run(e, range(1100, 5000, at => ({ ...center(at), confidence: 0.9 })));
  assert.equal(last.debug.gaze, 'CENTER');
  assert.equal(last.classification, 'NORMAL');
});

// ── Cooldown + re-offence (spec §18) ────────────────────────────────────────

test('returning to centre then looking away again after the cooldown warns a second time', () => {
  const e = engine();
  const first = run(e, [
    ...range(0, 500, center),
    ...range(600, 6000, at => ({ ...center(at), yawDeg: 45 })),
    ...range(6100, 7000, center), // returns to centre → incident closed
  ]);
  assert.equal(first.events.length, 1);

  const second = run(e, [
    ...range(12_000, 12_500, center),
    ...range(12_600, 20_000, at => ({ ...center(at), yawDeg: 45 })), // new sustained incident
  ]);
  assert.equal(second.events.length, 1, 'a repeat after the cooldown is a new warning');
  assert.equal(second.events[0].type, 'HEAD_AWAY');
});

test('a repeat inside the cooldown window is suppressed and reported as such', () => {
  const e = engine();
  const first = run(e, [
    ...range(0, 500, center),
    ...range(600, 6000, at => ({ ...center(at), yawDeg: 45 })),
    ...range(6100, 6500, center),
  ]);
  assert.equal(first.events.length, 1);

  // Re-offends ~2s after the first warning: inside the 10s cooldown.
  const second = run(e, [
    ...range(7000, 7200, center),
    ...range(7300, 12_000, at => ({ ...center(at), yawDeg: 45 })),
  ]);
  assert.equal(second.events.length, 0, 'cooldown must prevent warning spam');
});

// ── Camera loss (spec §12) ──────────────────────────────────────────────────

test('a stopped media track is CRITICAL and blocking', () => {
  const { events, last } = run(engine(), [
    ...range(0, 500, center),
    { at: 600, facePresent: false, faceCount: 0, confidence: 0, mediaTrackEnded: true },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'MEDIA_TRACK_ENDED');
  assert.equal(events[0].severity, 'CRITICAL');
  assert.equal(last.classification, 'SESSION_REVIEW_REQUIRED');
  assert.equal(last.activeIncidentType, 'MEDIA_TRACK_ENDED');
});

// ── Session classification + severity (spec §17/§21) ────────────────────────

test('session classification tracks the authoritative warning count', () => {
  assert.equal(classifySession(0, 5), 'NORMAL');
  assert.equal(classifySession(1, 5), 'WARNING');
  assert.equal(classifySession(2, 5), 'REPEATED_WARNING');
  assert.equal(classifySession(4, 5), 'REPEATED_WARNING');
  assert.equal(classifySession(5, 5), 'SESSION_REVIEW_REQUIRED');
  assert.equal(classifySession(9, 5), 'SESSION_REVIEW_REQUIRED');
});

test('session classification is inert to malformed counts', () => {
  assert.equal(classifySession(NaN, 5), 'NORMAL');
  assert.equal(classifySession(-3, 5), 'NORMAL');
  assert.equal(classifySession(2, 0), 'REPEATED_WARNING', 'a zero max falls back to the default');
});

test('only WARNING and CRITICAL consume the limited warning budget', () => {
  assert.equal(severityConsumesWarning('OBSERVATION'), false, 'an observation must not increment');
  assert.equal(severityConsumesWarning('WARNING'), true);
  assert.equal(severityConsumesWarning('CRITICAL'), true);
});

test('there is no CHEATER state and the copy never claims cheating (spec §1/§41)', () => {
  const serialised = JSON.stringify(INTEGRITY_EVENT_COPY).toLowerCase();
  for (const forbidden of ['cheat', 'cheating', 'dishonest', 'liar', 'caught', 'fraud']) {
    assert.ok(!serialised.includes(forbidden), `candidate-facing copy must not say "${forbidden}"`);
  }
  const types = INTEGRITY_EVENT_TYPES.join(',');
  assert.ok(!/CHEAT/i.test(types));
});

test('every event type has candidate-facing copy', () => {
  for (const type of INTEGRITY_EVENT_TYPES) {
    assert.ok(INTEGRITY_EVENT_COPY[type], `missing copy for ${type}`);
    assert.ok(INTEGRITY_EVENT_COPY[type].title.length > 0);
    assert.ok(INTEGRITY_EVENT_COPY[type].message.length > 0);
  }
});

test('thresholds are never violated by the defaults themselves', () => {
  const c = DEFAULT_INTEGRITY_CONFIG;
  assert.ok(c.ignoreAwayMs < c.warningAwayMs, 'an observation tier must precede the warning tier');
  assert.ok(c.faceMissingIgnoreMs < c.faceMissingWarningMs);
  assert.ok(c.multipleFacesIgnoreMs < c.multipleFacesWarningMs);
  assert.ok(c.maxWarnings > 0);
  assert.ok(c.sampleFps >= 5 && c.sampleFps <= 10, 'spec §24 asks for 5-10 FPS analysis');
});

// ── Determinism / replayability ─────────────────────────────────────────────

test('the same observation sequence produces identical events on replay', () => {
  const sequence = [
    ...range(0, 500, center),
    ...range(600, 6000, at => ({ ...center(at), yawDeg: 45 })),
    ...range(6100, 7000, center),
  ];
  const a = run(engine(), sequence).events;
  const b = run(engine(), sequence).events;
  assert.deepEqual(a, b, 'integrity decisions must be reproducible, not random');
});

test('reset clears in-progress incidents', () => {
  const e = engine();
  run(e, [...range(0, 500, center), ...range(600, 3000, at => ({ ...center(at), yawDeg: 45 }))]);
  e.reset();
  const { events } = run(e, range(3000, 3200, at => ({ ...center(at), yawDeg: 45 })));
  assert.equal(events.length, 0, 'after a reset the incident timer starts over');
});
