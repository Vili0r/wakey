/**
 * Onboarding state — a typed, in-memory store for the user's answers as they
 * move through the flow. Lives in a Context provided by the (onboarding)
 * group layout, so every screen reads/writes the same object without prop
 * drilling. Nothing here touches the database; persistence happens once, at
 * the end, via @/onboarding/persistence.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type OnboardingState = {
  /** Option id from the MORNING_PERSON question (first survey beat). */
  morningPerson: string | null;
  /** Option id from the SNOOZE question. */
  snooze: string | null;
  /** Chosen wake time (24h). Prefills the user's first alarm. */
  wakeHour: number;
  wakeMinute: number;
  /** Chosen challenge id (see CHALLENGE_MAPPING) for the first alarm. */
  mission: string;
  /** Single-select answer ids. */
  mornings: string | null;
  /** Option id from the BACK_TO_SLEEP question. */
  backToSleep: string | null;
  hardest: string | null;
  currentWake: string | null;
  /** Multi-select answer ids. */
  realMorning: string[];
  /** How committed they pledged to be (0 = unset). */
  commitment: number;
  /** Whether they completed the "raise the sun" ritual. */
  committed: boolean;
};

const DEFAULT_STATE: OnboardingState = {
  morningPerson: null,
  snooze: null,
  wakeHour: 7,
  wakeMinute: 0,
  mission: 'math',
  mornings: null,
  backToSleep: null,
  hardest: null,
  currentWake: null,
  realMorning: [],
  commitment: 0,
  committed: false,
};

type OnboardingContextValue = {
  state: OnboardingState;
  /** Shallow-merge a partial update into the answer state. */
  update: (patch: Partial<OnboardingState>) => void;
  /** Toggle a value within a multi-select array field. */
  toggleMulti: (key: 'realMorning', id: string) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      state,
      update: (patch) => setState((prev) => ({ ...prev, ...patch })),
      toggleMulti: (key, id) =>
        setState((prev) => {
          const current = prev[key];
          const next = current.includes(id)
            ? current.filter((x) => x !== id)
            : [...current, id];
          return { ...prev, [key]: next };
        }),
    }),
    [state],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return ctx;
}
