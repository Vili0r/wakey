/** Screen 4 — quick personal question: snooze habit (feeds the stat reveal). */

import { QuestionScreen } from '@/components/onboarding/question-screen';
import { SNOOZE } from '@/onboarding/questions';
import { router } from 'expo-router';

export default function QSnooze() {
  return (
    <QuestionScreen
      question={SNOOZE}
      progress={0.2}
      onNext={() => router.push('/q-waketime')}
    />
  );
}
