import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { NavTabs } from '@/components/layout/NavTabs';
import { NextSessionCard } from '@/components/dashboard/NextSessionCard';
import { DayProgress } from '@/components/dashboard/DayProgress';
import { SessionList } from '@/components/dashboard/SessionList';
import { BadgeCelebration } from '@/components/badges/BadgeCelebration';
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
  const { status: authStatus } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/login');
  }, [authStatus, router]);

  const {
    settings, todaySessions, todayStats, allStats,
    completeSession, undoSession, skipSession, snoozeSession,
    updateSettings, initialized, cloudSynced, todayIsRestDay, todayIsPaused,
    newlyEarnedBadges, dismissBadges,
  } = useAppState();

  const [repOverrides, setRepOverrides] = useState<Record<string, number>>({});

  if (authStatus === 'loading' || authStatus === 'unauthenticated') return null;
  if (!initialized || !cloudSynced) return null;

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
      <header className="sticky top-0 z-50 bg-[var(--c0)]/95 backdrop-blur border-b border-[var(--c2)] px-4 pt-4 pb-3">
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
        {/* Pause banner */}
        {todayIsPaused && (
          <div className="bg-[#1A1A0D] border border-[#FACC15]/40 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 flex items-center justify-center text-2xl shrink-0">🏖️</div>
            <div>
              <p className="text-[#FACC15] font-semibold text-sm">Vacation mode on</p>
              <p className="text-[var(--ct2)] text-xs mt-0.5">
                Sessions paused until {settings.pausedUntil} — your streak is safe.
              </p>
            </div>
          </div>
        )}

        {/* Rest day card */}
        {todayIsRestDay && !todayIsPaused && (
          <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--c4)] flex items-center justify-center text-3xl">🛋️</div>
            <div>
              <p className="text-[var(--ct0)] font-semibold text-base">Rest day</p>
              <p className="text-[var(--ct2)] text-sm mt-1">No sessions scheduled today — enjoy the recovery.</p>
            </div>
          </div>
        )}

        {/* Next session hero + session timeline (hidden on rest/pause days) */}
        {!todayIsRestDay && !todayIsPaused && (
          <>
            <NextSessionCard
              sessions={todaySessions}
              enabledExercises={enabledExercises}
              customExerciseLabels={settings.customExerciseLabels}
              customExerciseTrackingTypes={settings.customExerciseTrackingTypes}
              targetReps={todayReps}
              repOverrides={repOverrides}
              onRepChange={(key, val) => setRepOverrides(prev => ({ ...prev, [key]: val }))}
              noSessionsHint={
                settings.reminders.scheduleMode === 'custom' &&
                (settings.reminders.customMinutes ?? []).length === 0
                  ? 'Custom schedule has no time marks — select some in Settings, or switch to Every hour.'
                  : undefined
              }
            />
            <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-4">
              <SessionList
                sessions={todaySessions}
                enabledExercises={enabledExercises}
                customExerciseLabels={settings.customExerciseLabels}
                targetReps={todayReps}
                repOverrides={repOverrides}
                onComplete={completeSession}
                onUndo={undoSession}
                onSkip={skipSession}
                onSnooze={snoozeSession}
              />
            </div>
          </>
        )}

        {/* Day progress bar */}
        <DayProgress
          stats={todayStats}
          targetReps={todayReps}
          enabledExercises={enabledExercises}
          customExerciseLabels={settings.customExerciseLabels}
          customExerciseTrackingTypes={settings.customExerciseTrackingTypes}
        />
      </main>

      <NavTabs />
      <BadgeCelebration badges={newlyEarnedBadges} onDismiss={dismissBadges} />
    </div>
  );
}
