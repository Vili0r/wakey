/**
 * Pure pose math — plain JS (no worklets). We run the model in the camera
 * worklet, ship raw keypoints to JS via scheduleOnRN, and do the cheap angle
 * math here on the main thread. At the throttled frame rate this is trivial
 * and keeps the logic easy to unit-test.
 *
 * usePoseEstimation returns PersonKeypoints[] keyed by COCO keypoint names,
 * each { x, y } in screen space. Hidden keypoints come back as { x:-1, y:-1 }.
 */

export type Keypoint = { x: number; y: number };

/** COCO 17-keypoint names emitted by the YOLO26N-Pose model. */
export type CocoKeypointName =
  | 'NOSE'
  | 'LEFT_EYE'
  | 'RIGHT_EYE'
  | 'LEFT_EAR'
  | 'RIGHT_EAR'
  | 'LEFT_SHOULDER'
  | 'RIGHT_SHOULDER'
  | 'LEFT_ELBOW'
  | 'RIGHT_ELBOW'
  | 'LEFT_WRIST'
  | 'RIGHT_WRIST'
  | 'LEFT_HIP'
  | 'RIGHT_HIP'
  | 'LEFT_KNEE'
  | 'RIGHT_KNEE'
  | 'LEFT_ANKLE'
  | 'RIGHT_ANKLE';

export type PersonKeypoints = Partial<Record<CocoKeypointName, Keypoint>>;

/** A keypoint the model couldn't see is returned as (-1, -1). */
export function isVisible(kp: Keypoint | undefined): kp is Keypoint {
  return !!kp && kp.x >= 0 && kp.y >= 0;
}

/**
 * Interior angle at joint B for points A-B-C, in degrees (0–180).
 * Returns null if any point is missing/invisible or degenerate.
 */
export function angleDeg(
  a: Keypoint | undefined,
  b: Keypoint | undefined,
  c: Keypoint | undefined,
): number | null {
  if (!isVisible(a) || !isVisible(b) || !isVisible(c)) return null;
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const magAB = Math.hypot(abx, aby);
  const magCB = Math.hypot(cbx, cby);
  if (magAB === 0 || magCB === 0) return null;
  let cos = (abx * cbx + aby * cby) / (magAB * magCB);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Knee angle (HIP-KNEE-ANKLE) for squats. Prefers whichever leg is fully
 * visible; averages both when both are available. Null if neither is usable.
 */
export function kneeAngle(p: PersonKeypoints): number | null {
  const left = angleDeg(p.LEFT_HIP, p.LEFT_KNEE, p.LEFT_ANKLE);
  const right = angleDeg(p.RIGHT_HIP, p.RIGHT_KNEE, p.RIGHT_ANKLE);
  return average(left, right);
}

/**
 * Elbow angle (SHOULDER-ELBOW-WRIST) for push-ups. Same side logic.
 */
export function elbowAngle(p: PersonKeypoints): number | null {
  const left = angleDeg(p.LEFT_SHOULDER, p.LEFT_ELBOW, p.LEFT_WRIST);
  const right = angleDeg(p.RIGHT_SHOULDER, p.RIGHT_ELBOW, p.RIGHT_WRIST);
  return average(left, right);
}

/**
 * A representative body size in pixels — used as a proximity signal for
 * push-ups when the phone is flat on the ground. As the chest lowers toward a
 * floor-placed phone the whole body grows in frame; pushing up shrinks it.
 *
 * Picks the most reliable available measurement, in order:
 *   1. shoulder-midpoint → hip-midpoint distance (torso length),
 *   2. inter-shoulder distance,
 *   3. nose → shoulder-midpoint distance.
 * Returns null when not even the shoulders are visible.
 */
export function bodyScale(p: PersonKeypoints): number | null {
  const sL = p.LEFT_SHOULDER;
  const sR = p.RIGHT_SHOULDER;
  if (!isVisible(sL) || !isVisible(sR)) return null;
  const shoulderMid = { x: (sL.x + sR.x) / 2, y: (sL.y + sR.y) / 2 };

  const hL = p.LEFT_HIP;
  const hR = p.RIGHT_HIP;
  const hips = [hL, hR].filter(isVisible) as Keypoint[];
  if (hips.length > 0) {
    const hipMid =
      hips.length === 2
        ? { x: (hips[0].x + hips[1].x) / 2, y: (hips[0].y + hips[1].y) / 2 }
        : hips[0];
    const torso = Math.hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y);
    if (torso > 0) return torso;
  }

  const interShoulder = Math.hypot(sL.x - sR.x, sL.y - sR.y);
  if (interShoulder > 0) return interShoulder;

  if (isVisible(p.NOSE)) {
    const d = Math.hypot(p.NOSE.x - shoulderMid.x, p.NOSE.y - shoulderMid.y);
    if (d > 0) return d;
  }
  return null;
}

/** How many of the given keypoints are visible — used for guidance prompts. */
export function visibleCount(
  p: PersonKeypoints,
  names: CocoKeypointName[],
): number {
  return names.filter((n) => isVisible(p[n])).length;
}

function average(a: number | null, b: number | null): number | null {
  if (a != null && b != null) return (a + b) / 2;
  return a ?? b;
}
