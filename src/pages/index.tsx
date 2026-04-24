import { useState } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { NavTabs } from '@/components/layout/NavTabs';
import { NextSessionCard } from '@/components/dashboard/NextSessionCard';
import { DayProgress } from '@/components/dashboard/DayProgress';
import { SessionList } from '@/components/dashboard/SessionList';
import { getPlanStatusForDate } from '@/lib/compliance';
import type { AppSettings } from '@/types';

const DEFAULT_EXERCISES = { pushups: true, squats: true, situps: true };

/** Returns true if the user has any prior saved data (logs or profile), indicating a returning user. */
function hasExistingData(): boolean {
  try {
    const logs    = localStorage.getItem('puh_logs');
    const profile = localStorage.getItem('puh_profile');
    if (logs && Object.keys(JSON.parse(logs)).length > 0) return true;
    if (profile) {
      const p = JSON.parse(profile);
      if (p?.name) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export default function Today() {
  const {
    settings, todaySessions, todayStats, allStats,
    completeSession, undoSession, skipSession, snoozeSession,
    updateSettings, initialized,
  } = useAppState();

  const [repOverrides, setRepOverrides] = useState<Record<string, number>>({});

  if (!initialized) return null;

  if (!settings.onboardingComplete) {
    return (
      <OnboardingWizard
        onComplete={partial => updateSettings(partial as Partial<AppSettings>)}
        isReturningUser={hasExistingData()}
      />
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const { reps: todayReps, status: planStatus } = getPlanStatusForDate(today, settings, allStats);
  const enabledExercises = settings.enabledExercises ?? DEFAULT_EXERCISES;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const PLAN_LABEL: Record<string, { label: string; color: string }> = {
    progressing: { label: 'On Track',      color: '#22C55E' },
    holding:     { label: 'Holding',       color: '#FACC15' },
    deloading:   { label: 'Deload Active', color: '#FB923C' },
  };
  const plan = PLAN_LABEL[planStatus] ?? { label: planStatus, color: 'var(--ct1)' };

  return (
    <div className="min-h-screen bg-[var(--c0)] text-[var(--ct0)] font-sans pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-b from-[var(--c1)]/95 to-[var(--c0)]/95 backdrop-blur border-b border-[var(--c5)]/40 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--ct0)] text-xl font-bold">{greeting}</h1>
            <p className="text-[var(--ct2)] text-xs mt-0.5">
              {todayStats.completed}/{todayStats.totalSessions} sessions done · {todayReps} reps target
            </p>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ color: plan.color, background: `${plan.color}18` }}
          >
            {plan.label}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Next session hero */}
        <NextSessionCard
          sessions={todaySessions}
          enabledExercises={enabledExercises}
          customExerciseLabels={settings.customExerciseLabels}
          targetReps={todayReps}
          repOverrides={repOverrides}
          onRepChange={(key, val) => setRepOverrides(prev => ({ ...prev, [key]: val }))}
        />

        {/* Session timeline */}
        <div className="bg-gradient-to-br from-[var(--c2)] to-[var(--c0)] border border-[var(--c5)]/60 rounded-2xl p-4">
          <SessionList
            sessions={todaySessions}
            enabledExercises={enabledExercises}
            targetReps={todayReps}
            repOverrides={repOverrides}
            excludeId={todaySessions.find(s => s.status === 'pending' || s.status === 'snoozed')?.id}
            onComplete={completeSession}
            onUndo={undoSession}
            onSkip={skipSession}
            onSnooze={snoozeSession}
          />
        </div>

        {/* Day progress bar */}
        <DayProgress stats={todayStats} targetReps={todayReps} />
      </main>

      <NavTabs />
    </div>
  );
}
