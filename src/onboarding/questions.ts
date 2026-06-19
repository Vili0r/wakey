/**
 * questions — the single source of truth for the onboarding survey copy.
 *
 * Each deliberate question's options are intentional: the answer ids are what
 * we persist and what later screens (reveal-stat, reflect) play back. Keeping
 * the copy here keeps the screen components thin and the wording consistent.
 */

export type Option = {
  /** Stable id persisted in OnboardingState — never the display label. */
  id: string;
  label: string;
  /** Optional sub-label shown under the option. */
  hint?: string;
};

export type Question = {
  /** Maps to a key on OnboardingState. */
  key: 'morningPerson' | 'snooze' | 'mornings' | 'backToSleep' | 'hardest' | 'currentWake' | 'realMorning';
  title: string;
  /** Optional small-caps eyebrow above the title. */
  eyebrow?: string;
  multi?: boolean;
  options: Option[];
};

export const MORNING_PERSON: Question = {
  key: 'morningPerson',
  eyebrow: 'FIRST, THE TRUTH',
  title: 'Are you a morning person?',
  options: [
    { id: 'yes', label: 'Yes — I’m up with the sun' },
    { id: 'sometimes', label: 'Some days, not others' },
    { id: 'no', label: 'Not really — mornings are a fight' },
    { id: 'never', label: 'Absolutely not, I’m a night owl' },
  ],
};

export const SNOOZE: Question = {
  key: 'snooze',
  eyebrow: 'THE SNOOZE BUTTON',
  title: 'How many times do you hit snooze?',
  options: [
    { id: 'never', label: 'I get up on the first ring' },
    { id: 'once', label: 'Once, then I’m up' },
    { id: 'few', label: 'Two or three rounds' },
    { id: 'many', label: 'Four or more — it’s a ritual' },
  ],
};

export const MORNINGS: Question = {
  key: 'mornings',
  eyebrow: 'BE HONEST',
  title: 'How do your mornings usually feel?',
  options: [
    { id: 'groggy', label: 'Foggy and slow to start' },
    { id: 'battle', label: 'A fight with myself every time' },
    { id: 'rushed', label: 'Rushed — I’m always behind' },
    { id: 'rough', label: 'Rough. I dread the alarm' },
  ],
};

export const BACK_TO_SLEEP: Question = {
  key: 'backToSleep',
  eyebrow: 'THE RELAPSE',
  title: 'Do you ever turn off the alarm and go back to sleep?',
  options: [
    { id: 'often', label: 'Often' },
    { id: 'sometimes', label: 'Sometimes' },
    { id: 'rarely', label: 'Rarely' },
    { id: 'never', label: 'Never' },
  ],
};

export const HARDEST: Question = {
  key: 'hardest',
  eyebrow: 'THE REAL OBSTACLE',
  title: 'What’s the hardest part of your morning?',
  options: [
    { id: 'leaving-bed', label: 'Actually leaving the bed' },
    { id: 'snooze-spiral', label: 'Breaking the snooze spiral' },
    { id: 'brain-fog', label: 'Shaking off the brain fog' },
    { id: 'dread', label: 'Facing the day ahead' },
  ],
};

export const CURRENT_WAKE: Question = {
  key: 'currentWake',
  eyebrow: 'RIGHT NOW',
  title: 'How do you wake up today?',
  options: [
    { id: 'phone', label: 'One phone alarm', hint: 'Easy to swipe away' },
    { id: 'stacked', label: 'A wall of backup alarms', hint: 'And I still sleep through' },
    { id: 'someone', label: 'Someone has to wake me' },
    { id: 'oversleep', label: 'Honestly? I oversleep a lot' },
  ],
};

export const REAL_MORNING: Question = {
  key: 'realMorning',
  eyebrow: 'IMAGINE IT',
  title: 'What would a real morning give you?',
  multi: true,
  options: [
    { id: 'calm', label: 'A calm, unrushed start' },
    { id: 'time', label: 'Time that’s actually mine' },
    { id: 'ontime', label: 'Being on time, for once' },
    { id: 'energy', label: 'Energy that lasts all day' },
  ],
};

/** Approximate snoozes-per-morning for each answer, used for the stat reveal. */
export const SNOOZES_PER_DAY: Record<string, number> = {
  never: 0,
  once: 1,
  few: 3,
  many: 5,
};

/** Minutes lost to a single snooze cycle (lying half-awake). */
const MINUTES_PER_SNOOZE = 9;

export type SnoozeStat = {
  snoozesPerDay: number;
  minutesPerDay: number;
  hoursPerYear: number;
  daysPerYear: number;
};

/** Turn a snooze answer into the lost-time figures used on the reveal screen. */
export function snoozeStat(answer: string | null): SnoozeStat {
  const snoozesPerDay = answer ? (SNOOZES_PER_DAY[answer] ?? 2) : 2;
  const minutesPerDay = snoozesPerDay * MINUTES_PER_SNOOZE;
  const hoursPerYear = Math.round((minutesPerDay * 365) / 60);
  const daysPerYear = Math.round((hoursPerYear / 24) * 10) / 10;
  return { snoozesPerDay, minutesPerDay, hoursPerYear, daysPerYear };
}
