/** Screen 9 — the hardest part of their morning (a deliberate, framing question). */

import { QuestionScreen } from '@/components/onboarding/question-screen';
import { HARDEST } from '@/onboarding/questions';
import { router } from 'expo-router';

export default function QHardest() {
  return (
    <QuestionScreen
      question={HARDEST}
      progress={0.56}
      onNext={() => router.push('/sleep-inertia')}
    />
  );
}
