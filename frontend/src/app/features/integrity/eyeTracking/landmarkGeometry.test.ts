/**
 * AETHER — MediaPipe landmark geometry tests.
 *
 * NO WEBCAM, NO WASM, NO GPU, NO NETWORK. Every case feeds DETERMINISTIC
 * landmark fixtures that satisfy the real MediaPipe index contract, so the
 * overlay math, the iris geometry and the head-pose extraction can be verified
 * on CI where no camera exists.
 *
 * Run with:  npm run test:integrity
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLENDSHAPE_EYE_BLINK_LEFT,
  BLENDSHAPE_EYE_BLINK_RIGHT,
  FACE_LANDMARK_COUNT,
  LEFT_EYE_BOTTOM,
  LEFT_EYE_INNER_CORNER,
  LEFT_EYE_OUTER_CORNER,
  LEFT_EYE_TOP,
  LEFT_IRIS_CENTER,
  RIGHT_EYE_BOTTOM,
  RIGHT_EYE_INNER_CORNER,
  RIGHT_EYE_OUTER_CORNER,
  RIGHT_EYE_TOP,
  RIGHT_IRIS_CENTER,
  TOTAL_LANDMARK_COUNT,
  combinedIrisOffset,
  computeFrameTransform,
  eyeAspectRatio,
  eyeOpenness,
  gazePolarityX,
  hasRequiredLandmarks,
  headPoseFromLandmarks,
  headPoseFromMatrix,
  irisOffset,
  mapLandmarkToDisplay,
  type Landmark,
} from './landmarks';

/**
 * A fixture face laid out on the canonical topology.
 *
 * Geometry mirrors a real face in an UN-MIRRORED camera frame: the candidate's
 * left eye (indices 33/133/468) sits at the RIGHT of the image, and their right
 * eye (263/362/473) sits at the LEFT.
 */
function makeFace(options: {
  irisShiftX?: number; // -1 iris at the left edge of its eye .. +1 at the right edge
  irisShiftY?: number; // -1 iris under the upper lid .. +1 above the lower lid
  eyelidGap?: number;  // vertical lid separation as a fraction of eye width
  yawShift?: number;   // horizontal nose-bridge shift, fraction of eye span
} = {}): Landmark[] {
  const { irisShiftX = 0, irisShiftY = 0, eyelidGap = 0.32, yawShift = 0 } = options;
  const landmarks: Landmark[] = Array.from({ length: TOTAL_LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  const set = (index: number, x: number, y: number) => {
    landmarks[index] = { x, y, z: 0 };
  };

  // Eye layout, 0.08 wide in normalised units.
  // Candidate-LEFT eye sits at the RIGHT of the image (x 0.52..0.60) with its
  //   inner corner (133) nearer the nose, i.e. at the LOWER x.
  // Candidate-RIGHT eye sits at the LEFT of the image (x 0.40..0.48) with its
  //   inner corner (362) nearer the nose, i.e. at the HIGHER x.
  const left = {
    inner: LEFT_EYE_INNER_CORNER, outer: LEFT_EYE_OUTER_CORNER,
    top: LEFT_EYE_TOP, bottom: LEFT_EYE_BOTTOM, iris: LEFT_IRIS_CENTER,
    innerX: 0.52, outerX: 0.60,
  };
  const right = {
    inner: RIGHT_EYE_INNER_CORNER, outer: RIGHT_EYE_OUTER_CORNER,
    top: RIGHT_EYE_TOP, bottom: RIGHT_EYE_BOTTOM, iris: RIGHT_IRIS_CENTER,
    innerX: 0.48, outerX: 0.40,
  };

  for (const eye of [left, right]) {
    const midX = (eye.innerX + eye.outerX) / 2;
    set(eye.inner, eye.innerX, 0.40);
    set(eye.outer, eye.outerX, 0.40);
    set(eye.top, midX, 0.40 - eyelidGap * 0.04);
    set(eye.bottom, midX, 0.40 + eyelidGap * 0.04);
    // The iris travels across its own eye as irisShiftX goes -1 → +1.
    set(eye.iris, midX + irisShiftX * 0.04, 0.40 + irisShiftY * eyelidGap * 0.04);
  }

  // Nose bridge between the eyes, plus chin/forehead for the pose fallback.
  const eyeMidX = 0.50;
  set(168, eyeMidX + yawShift * 0.08, 0.44);  // NOSE_BRIDGE
  set(1, eyeMidX + yawShift * 0.08, 0.48);    // NOSE_TIP
  set(152, eyeMidX, 0.68);                    // CHIN
  set(10, eyeMidX, 0.22);                     // FOREHEAD

  return landmarks;
}

test('fixture satisfies the real MediaPipe landmark contract', () => {
  const face = makeFace();
  assert.equal(face.length, TOTAL_LANDMARK_COUNT);
  assert.equal(FACE_LANDMARK_COUNT, 468);
  assert.ok(hasRequiredLandmarks(face), 'a full 478-point mesh must be accepted');
  assert.equal(hasRequiredLandmarks(face.slice(0, 467)), false, 'a truncated mesh must be rejected, not guessed at');
  assert.equal(hasRequiredLandmarks(null), false);
  assert.equal(hasRequiredLandmarks([]), false);
});

test('Eye Aspect Ratio scales with real eyelid separation', () => {
  const open = makeFace({ eyelidGap: 0.34 });
  const closed = makeFace({ eyelidGap: 0.04 });
  const openEar = eyeAspectRatio(open, 'LEFT');
  const closedEar = eyeAspectRatio(closed, 'LEFT');
  assert.ok(openEar !== null && closedEar !== null);
  assert.ok(openEar! > closedEar!, 'open eye must have a larger aspect ratio than a closed one');
  // Both eyes are drawn identically, so their ratios must agree.
  assert.ok(Math.abs(eyeAspectRatio(open, 'LEFT')! - eyeAspectRatio(open, 'RIGHT')!) < 1e-9);
});

test('iris offset is expressed against the eye corners, not the screen', () => {
  const centred = irisOffset(makeFace({ irisShiftX: 0 }), 'LEFT');
  assert.ok(centred !== null);
  assert.ok(Math.abs(centred!.x) < 1e-9, 'a centred iris must read as zero offset');

  const shiftedRight = irisOffset(makeFace({ irisShiftX: 1 }), 'LEFT');
  const shiftedLeft = irisOffset(makeFace({ irisShiftX: -1 }), 'LEFT');
  assert.ok(shiftedRight!.x > 0.9, `a right-shifted iris must read positive, got ${shiftedRight!.x}`);
  assert.ok(shiftedLeft!.x < -0.9, `a left-shifted iris must read negative, got ${shiftedLeft!.x}`);

  // The offset is a RATIO of the candidate's own eye width, so a face 20%
  // larger or smaller keeps the same reading: this is what makes gaze survive
  // the candidate leaning towards or away from the camera.
  const bigger = makeFace({ irisShiftX: 0.5, eyelidGap: 0.32 });
  for (let i = 0; i < bigger.length; i++) {
    bigger[i] = { x: 0.5 + (bigger[i].x - 0.5) * 1.2, y: 0.5 + (bigger[i].y - 0.5) * 1.2, z: 0 };
  }
  assert.ok(Math.abs(irisOffset(bigger, 'LEFT')!.x - 0.5) < 1e-9, 'scale must not change a normalised iris offset');
});

test('both eyes agree on horizontal gaze (this is the misplaced-marker bug)', () => {
  // Looking towards the right of the frame moves BOTH irises towards the right
  // of the frame. If a per-eye sign flip is applied (the common mistake), the
  // two eyes disagree and the marker lands on the wrong side of the face.
  for (const shift of [-0.6, -0.2, 0.2, 0.6]) {
    const face = makeFace({ irisShiftX: shift });
    const left = irisOffset(face, 'LEFT')!;
    const right = irisOffset(face, 'RIGHT')!;
    assert.ok(
      Math.sign(left.x) === Math.sign(right.x),
      `eyes must agree on gaze direction at shift ${shift}: left=${left.x}, right=${right.x}`,
    );
    assert.ok(Math.abs(left.x - right.x) < 1e-9, 'both eyes must report the same magnitude in image space');
  }

  assert.equal(gazePolarityX(combinedIrisOffset(makeFace({ irisShiftX: 0.5 }))!), 'RIGHT');
  assert.equal(gazePolarityX(combinedIrisOffset(makeFace({ irisShiftX: -0.5 }))!), 'LEFT');
  assert.equal(gazePolarityX(combinedIrisOffset(makeFace())!), 'CENTER');
  assert.equal(gazePolarityX(null), 'UNKNOWN');
});

test('blendshape eye closure is preferred, EAR is the fallback', () => {
  const face = makeFace({ eyelidGap: 0.32 });
  const closedBlend = { [BLENDSHAPE_EYE_BLINK_LEFT]: 0.95, [BLENDSHAPE_EYE_BLINK_RIGHT]: 0.95 };
  const openBlend = { [BLENDSHAPE_EYE_BLINK_LEFT]: 0.02, [BLENDSHAPE_EYE_BLINK_RIGHT]: 0.02 };

  const viaBlend = eyeOpenness(face, closedBlend, 'LEFT')!;
  assert.equal(viaBlend.source, 'BLENDSHAPE');
  assert.ok(viaBlend.open < 0.1, `blendshape closure must read closed, got ${viaBlend.open}`);

  const openViaBlend = eyeOpenness(face, openBlend, 'LEFT')!;
  assert.ok(openViaBlend.open > 0.9);

  // No blendshapes → the EAR path, scaled against the calibrated open value.
  const closedEye = makeFace({ eyelidGap: 0.04 });
  const viaEar = eyeOpenness(closedEye, null, 'LEFT', { openEar: 0.32 })!;
  assert.equal(viaEar.source, 'EAR');
  assert.ok(viaEar.open < 0.1, `EAR fallback must read closed, got ${viaEar.open}`);
  const openViaEar = eyeOpenness(face, null, 'LEFT', { openEar: 0.32 })!;
  assert.ok(openViaEar.open > 0.9, `EAR fallback must read open, got ${openViaEar.open}`);
  // Missing blendshape keys (not a malformed score) must fall back, not thrash.
  assert.equal(eyeOpenness(face, {}, 'LEFT')!.source, 'EAR');
});

test('head pose from the facial transformation matrix recovers known rotations', () => {
  // Identity ⇒ no rotation.
  const identity = headPoseFromMatrix([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])!;
  assert.ok(Math.abs(identity.yawDeg) < 1e-9);
  assert.ok(Math.abs(identity.pitchDeg) < 1e-9);
  assert.ok(Math.abs(identity.rollDeg) < 1e-9);

  // 30° about X (pitch).
  const deg = 30;
  const rad = (deg * Math.PI) / 180;
  const pitchMatrix = [
    1, 0, 0, 0,
    0, Math.cos(rad), -Math.sin(rad), 0,
    0, Math.sin(rad), Math.cos(rad), 0,
    0, 0, 0, 1,
  ];
  const pitched = headPoseFromMatrix(pitchMatrix)!;
  assert.ok(Math.abs(pitched.pitchDeg - deg) < 1e-6, `expected ${deg}° pitch, got ${pitched.pitchDeg}`);

  // 30° about Z (roll), which must not leak into pitch.
  const rollMatrix = [
    Math.cos(rad), -Math.sin(rad), 0, 0,
    Math.sin(rad), Math.cos(rad), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
  const rolled = headPoseFromMatrix(rollMatrix)!;
  assert.ok(Math.abs(rolled.rollDeg - deg) < 1e-6, `expected ${deg}° roll, got ${rolled.rollDeg}`);
  assert.ok(Math.abs(rolled.pitchDeg) < 1e-6, 'roll must not be misreported as pitch');

  assert.equal(headPoseFromMatrix(null), null);
  assert.equal(headPoseFromMatrix([1, 2, 3]), null, 'a short matrix must be rejected');
});

test('landmark head-pose fallback moves with the head and is neutral when centred', () => {
  const centred = headPoseFromLandmarks(makeFace())!;
  assert.ok(Math.abs(centred.yawDeg) < 1e-9);
  const turned = headPoseFromLandmarks(makeFace({ yawShift: 1 }))!;
  assert.ok(Math.abs(turned.yawDeg) > 20, `a shifted bridge must register as a turn, got ${turned.yawDeg}`);
});

test('overlay mapping reproduces the video exactly, including letterboxing and mirroring', () => {
  // 16:9 camera frame inside a 400x400 box with object-fit: cover ⇒ the frame is
  // scaled to 711.11 x 400 and cropped horizontally by 155.56px each side.
  const geometry = {
    displayWidth: 400,
    displayHeight: 400,
    videoWidth: 1280,
    videoHeight: 720,
    objectFit: 'cover' as const,
    mirrored: false,
    pixelRatio: 2,
  };
  const transform = computeFrameTransform(geometry);
  assert.ok(Math.abs(transform.scale - 400 / 720) < 1e-9);
  assert.ok(Math.abs(transform.offsetX - (400 - (1280 * (400 / 720))) / 2) < 1e-9);
  assert.equal(transform.offsetY, 0);

  // The frame centre must land on the box centre.
  const centre = mapLandmarkToDisplay({ x: 0.5, y: 0.5 }, transform, geometry);
  assert.ok(Math.abs(centre.x - 200) < 1e-9);
  assert.ok(Math.abs(centre.y - 200) < 1e-9);

  // A point at the frame's horizontal centre-top must stay centred.
  const topCentre = mapLandmarkToDisplay({ x: 0.5, y: 0 }, transform, geometry);
  assert.ok(Math.abs(topCentre.x - 200) < 1e-9);
  assert.equal(topCentre.y, 0);

  // contain: letterboxed, letterbox offsets instead of crop.
  const contain = computeFrameTransform({ ...geometry, objectFit: 'contain' });
  assert.ok(Math.abs(contain.scale - 400 / 1280) < 1e-9);
  assert.equal(contain.offsetX, 0);
  assert.ok(Math.abs(contain.offsetY - (400 - 720 * (400 / 1280)) / 2) < 1e-9);

  // fill: normalised coordinates map straight onto the box.
  const fill = computeFrameTransform({ ...geometry, objectFit: 'fill' });
  const filled = mapLandmarkToDisplay({ x: 0.25, y: 0.75 }, fill, { ...geometry, objectFit: 'fill' });
  assert.equal(filled.x, 100);
  assert.equal(filled.y, 300);
});

test('mirrored overlay is the horizontal mirror of the un-mirrored overlay', () => {
  const base = {
    displayWidth: 400,
    displayHeight: 400,
    videoWidth: 1280,
    videoHeight: 720,
    objectFit: 'cover' as const,
    pixelRatio: 1,
  };
  const plain = computeFrameTransform({ ...base, mirrored: false });
  const mirrored = computeFrameTransform({ ...base, mirrored: true });

  // The candidate's left eye sits at x = 0.56 of the frame.
  const eye = { x: 0.56, y: 0.4 };
  const plainPoint = mapLandmarkToDisplay(eye, plain, base);
  const mirroredPoint = mapLandmarkToDisplay(eye, mirrored, base);

  assert.ok(plainPoint.x > 200, 'un-mirrored: a right-of-frame eye must draw right of centre');
  assert.ok(mirroredPoint.x < 200, 'mirrored: the same eye must draw left of centre');

  // Mirroring is an exact reflection about the display centre.
  assert.ok(Math.abs((plainPoint.x + mirroredPoint.x) - 400) < 1e-9);
  assert.equal(plainPoint.y, mirroredPoint.y, 'mirroring must never move a point vertically');
});
