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
