/** Screen 11 — what a real morning would give them (multi-select; their "why"). */

import { QuestionScreen } from '@/components/onboarding/question-screen';
import { REAL_MORNING } from '@/onboarding/questions';
import { router } from 'expo-router';

export default function QRealMorning() {
  return (
    <QuestionScreen
      question={REAL_MORNING}
      progress={0.72}
      onNext={() => router.push('/reflect')}
    />
  );
}
