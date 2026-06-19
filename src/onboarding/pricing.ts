/**
 * pricing — single source of truth for the trial/subscription copy shown across
 * the three paywall screens. Placeholder figures for this build; wire to real
 * store products when billing lands.
 */

import { TRIAL_DAYS } from '@/onboarding/reminder';

export const PRICING = {
  trialDays: TRIAL_DAYS,
  /** What the user is charged today. */
  trialCta: 'Try For £0.00',
  monthly: '£2.50',
  yearly: '£29.99',
  /** "£2.50/mo" equivalent of the yearly plan. */
  perMonth: '£2.50',
} as const;
