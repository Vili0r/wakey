/** Screen 2 — open the survey with the core self-assessment: morning person? */

import { QuestionScreen } from '@/components/onboarding/question-screen';
import { MORNING_PERSON } from '@/onboarding/questions';
import { router } from 'expo-router';

export default function QMorningPerson() {
  return (
    <QuestionScreen
      question={MORNING_PERSON}
      progress={0.06}
      onNext={() => router.push('/q-snooze')}
    />
  );
}
