/** Screen 7 — do they kill the alarm and crawl back to sleep? (relapse habit). */

import { QuestionScreen } from '@/components/onboarding/question-screen';
import { BACK_TO_SLEEP } from '@/onboarding/questions';
import { router } from 'expo-router';

export default function QBackToSleep() {
  return (
    <QuestionScreen
      question={BACK_TO_SLEEP}
      progress={0.42}
      onNext={() => router.push('/analyzing')}
    />
  );
}
