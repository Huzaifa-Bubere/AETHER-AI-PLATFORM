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

// ── Eye closure (spec Parts I-M) ────────────────────────────────────────────

/** Both eyes wide open (blendshape-style openness, 1 = wide open). */
const eyesOpen = (at: number): FaceObservation => ({ ...center(at), leftEyeOpen: 0.95, rightEyeOpen: 0.95 });

/** Both eyes confidently shut. */
const eyesShut = (at: number): FaceObservation => ({ ...center(at), leftEyeOpen: 0.02, rightEyeOpen: 0.02 });

test('a natural blink never produces an event (spec Part J)', () => {
  const sequence: FaceObservation[] = [];
  // Three blinks of 200 ms each, well inside the 100-500 ms human range.
  for (const start of [0, 1000, 2000]) {
    sequence.push(...range(start, start + 700, eyesOpen));
    sequence.push(...range(start + 800, start + 1000, eyesShut));
  }
  // End on clearly open eyes: the final blink must have closed and released.
  sequence.push(...range(3100, 3500, eyesOpen));

  const { events, last } = run(engine(), sequence);
  assert.equal(events.length, 0, 'blinking is human and must never be counted');
  assert.equal(last.eyeState, 'EYES_OPEN', 'after a blink the eyes are reported open again');
  assert.equal(last.activeIncidentType, null, 'a blink must not leave an incident open');
});

test('closing both eyes for one second is ignored entirely (spec Part J)', () => {
  const { events } = run(engine(), [
    ...range(0, 400, eyesOpen),
    ...range(500, 1500, eyesShut),
    ...range(1600, 2000, eyesOpen),
  ]);
  assert.equal(events.length, 0, 'a short closure must not be suspicious');
});

test('both eyes closed for 3 continuous seconds emits exactly ONE event (spec Part K)', () => {
  const sequence = [...range(0, 500, eyesOpen), ...range(600, 4000, eyesShut)];
  const { events, last } = run(engine(), sequence);
  assert.equal(events.length, 1, 'one continuous closure is one incident');
  assert.equal(events[0].type, 'EYES_CLOSED_LONG');
  assert.equal(events[0].severity, 'WARNING');
  assert.ok(events[0].durationMs >= 3000, `the incident must record its real duration, got ${events[0].durationMs}`);
  assert.equal(events[0].startedAt, 600, 'the incident starts when the eyes closed, not when the warning fired');
  assert.equal(last.trackingState, 'EYES_CLOSED');
  assert.ok(last.debug.eyesClosedMs >= 3000);
});

test('staying closed for another 6 seconds does NOT re-warn (spec Parts L/AC)', () => {
  const { events } = run(engine(), [...range(0, 500, eyesOpen), ...range(600, 10_000, eyesShut)]);
  assert.equal(events.length, 1, '3s + 4s + 5s + 6s must be ONE warning, not four');
});

test('a closure between the blink window and 3 seconds is an observation, not a warning', () => {
  const sequence = [...range(0, 400, eyesOpen), ...range(500, 2000, eyesShut)];
  const { events, last } = run(engine(), sequence);
  assert.equal(events.length, 0, 'below the 3s threshold nothing is counted');
  assert.equal(last.classification, 'OBSERVATION');
  assert.equal(last.activeIncidentType, 'EYES_CLOSED_LONG');
});

test('reopening ends the incident and a later closure after the cooldown warns again (spec Part L)', () => {
  const e = engine();
  const first = run(e, [...range(0, 4000, eyesShut), ...range(4100, 4200, eyesOpen)]);
  assert.equal(first.events.length, 1, 'first sustained closure warns once');

  // Re-closing inside the 10 s cooldown must NOT create a second warning.
  const duringCooldown = run(e, [...range(5000, 9500, eyesShut), ...range(9600, 9700, eyesOpen)]);
  assert.equal(duringCooldown.events.length, 0, 'a repeat inside the cooldown is suppressed');

  // Past the cooldown the next sustained closure is a genuinely new incident.
  const afterCooldown = run(e, [...range(14_000, 18_000, eyesShut)]);
  assert.equal(afterCooldown.events.length, 1, 'a new closure after the cooldown warns again');
  assert.equal(afterCooldown.events[0].type, 'EYES_CLOSED_LONG');
});

test('one eye closed is an observation and never the 3-second warning (spec Part M)', () => {
  const oneEye = (at: number): FaceObservation => ({ ...center(at), leftEyeOpen: 0.95, rightEyeOpen: 0.05 });
  const { events, last } = run(engine(), [...range(0, 400, eyesOpen), ...range(500, 6000, oneEye)]);
  assert.equal(events.length, 0, 'a wink, a head angle or a tracking gap must not warn');
  assert.equal(last.classification, 'OBSERVATION');
  assert.equal(last.eyeState, 'ONE_EYE_CLOSED');
  assert.equal(last.trackingState, 'TRACKING_NORMAL', 'a one-sided closure is not "eyes closed"');
});

test('without any eyelid signal the state is UNKNOWN and nothing is emitted (spec Part R)', () => {
  const { events, last } = run(engine(), range(0, 5000, center));
  assert.equal(events.length, 0, 'absent eye landmarks mean "we do not know", not "eyes closed"');
  assert.equal(last.eyeState, 'UNKNOWN');
  assert.equal(last.trackingState, 'TRACKING_UNCERTAIN');
});

test('closed eyes suppress gaze/head warnings instead of double-counting (spec Part N)', () => {
  const shutWithHeadTurn = (at: number): FaceObservation => ({ ...eyesShut(at), yawDeg: 45 });
  const { events } = run(engine(), [...range(0, 9000, shutWithHeadTurn)]);
  assert.equal(events.length, 1, 'only the closure is counted, never also a gaze/head event');
  assert.equal(events[0].type, 'EYES_CLOSED_LONG');
});

test('eye-closure thresholds stay configurable and self-consistent', () => {
  const c = DEFAULT_INTEGRITY_CONFIG;
  assert.ok(c.eyesClosedIgnoreMs < c.eyesClosedWarningMs, 'the blink window must precede the warning threshold');
  assert.equal(c.eyesClosedWarningMs, 3000, 'the required rule is 3 continuous seconds');
  assert.ok(c.eyeOpenThreshold < c.eyeOpenReopenThreshold, 'hysteresis prevents flapping at the boundary');

  // A custom threshold is honoured, proving nothing is hardcoded in the engine.
  const strict = new IntegrityRulesEngine({ eyesClosedWarningMs: 1500, eyesClosedIgnoreMs: 800 }, BASELINE);
  const { events } = run(strict, [...range(0, 300, eyesOpen), ...range(400, 2500, eyesShut)]);
  assert.equal(events.length, 1);
  assert.ok(events[0].durationMs >= 1500);
});
