/** Screen 6 — how mornings feel right now (played back later in reflect). */

import { QuestionScreen } from '@/components/onboarding/question-screen';
import { MORNINGS } from '@/onboarding/questions';
import { router } from 'expo-router';

export default function QMornings() {
  return (
    <QuestionScreen
      question={MORNINGS}
      progress={0.36}
      onNext={() => router.push('/q-backtosleep')}
    />
  );
}
