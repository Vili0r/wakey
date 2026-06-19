/**
 * question-screen — renders one survey Question inside the OnboardingShell.
 *
 * It owns the single/multi select logic against the shared onboarding state,
 * disables Continue until there's an answer, and calls onNext to advance. Copy
 * lives in @/onboarding/questions so this stays a thin, reusable presenter.
 */

import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { PillOption } from '@/components/onboarding/pill-option';
import type { Question } from '@/onboarding/questions';
import { useOnboarding } from '@/onboarding/state';
import { View } from 'react-native';

export function QuestionScreen({
  question,
  progress,
  onNext,
}: {
  question: Question;
  progress: number;
  onNext: () => void;
}) {
  const { state, update, toggleMulti } = useOnboarding();

  const isSelected = (id: string): boolean => {
    if (question.multi) {
      return question.key === 'realMorning' && state.realMorning.includes(id);
    }
    return state[question.key] === id;
  };

  const onSelect = (id: string) => {
    if (question.multi) {
      if (question.key === 'realMorning') toggleMulti('realMorning', id);
    } else {
      update({ [question.key]: id } as Partial<typeof state>);
    }
  };

  const hasAnswer = question.multi
    ? state.realMorning.length > 0
    : state[question.key] != null;

  return (
    <OnboardingShell
      progress={progress}
      showBack
      eyebrow={question.eyebrow}
      title={question.title}
      subtitle={question.multi ? 'Pick all that fit.' : undefined}
      ctaLabel="Continue"
      ctaDisabled={!hasAnswer}
      onCta={onNext}
    >
      <View>
        {question.options.map((opt, i) => (
          <PillOption
            key={opt.id}
            index={i}
            label={opt.label}
            hint={opt.hint}
            selected={isSelected(opt.id)}
            onPress={() => onSelect(opt.id)}
          />
        ))}
      </View>
    </OnboardingShell>
  );
}
