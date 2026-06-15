/**
 * Shared challenge contract. Every challenge (camera or not) speaks this.
 */

export type ChallengeResult = {
  completed: boolean;
  attempts: number;
  durationMs: number;
};

export type ChallengeProps = {
  /** Overrides the difficulty-derived target when set. */
  targetReps?: number;
  difficulty: 'gentle' | 'standard' | 'brutal';
  onProgress?: (current: number, target: number) => void;
  onComplete: (result: ChallengeResult) => void;
  /** User gave up / accessibility escape. The caller decides how to log it. */
  onAbort?: () => void;
};

export const DIFFICULTY_REPS = {
  gentle: 1,
  standard: 3,
  brutal: 5,
} as const;

export function targetFor(
  difficulty: ChallengeProps['difficulty'],
  override?: number,
): number {
  return override ?? DIFFICULTY_REPS[difficulty];
}
