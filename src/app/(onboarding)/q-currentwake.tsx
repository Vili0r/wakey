/** Screen 10 — how they wake up today. */

import { QuestionScreen } from '@/components/onboarding/question-screen';
import { CURRENT_WAKE } from '@/onboarding/questions';
import { router } from 'expo-router';

export default function QCurrentWake() {
  return (
    <QuestionScreen
      question={CURRENT_WAKE}
      progress={0.64}
      onNext={() => router.push('/q-realmorning')}
    />
  );
}
