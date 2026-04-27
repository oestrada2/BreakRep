import type { DailyStats, EnabledExercises } from '@/types';

interface DayProgressProps {
  stats: DailyStats;
  targetReps: number;
  enabledExercises?: EnabledExercises;
  customExerciseLabels?: Record<string, string>;
  customExerciseTrackingTypes?: Record<string, 'reps' | 'time'>;
}

export function DayProgress({ stats, targetReps, enabledExercises, customExerciseLabels, customExerciseTrackingTypes }: DayProgressProps) {
  const pct = stats.totalSessions > 0
    ? Math.round((stats.completed / stats.totalSessions) * 100)
    : 0;

  const remaining = stats.totalSessions - stats.completed - stats.missed - stats.skipped;

  return (
    <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[var(--ct0)] text-sm font-semibold">Today's Progress</p>
        <span className={`text-sm font-bold ${pct >= 60 ? 'text-[#22C55E]' : pct >= 30 ? 'text-[#F97316]' : 'text-[#EF4444]'}`}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[var(--c4)] rounded-full h-2.5 mb-3 overflow-hidden">
        <div
          className="h-2.5 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 60
              ? 'linear-gradient(90deg, #16A34A, #22C55E)'
              : pct >= 30
              ? 'linear-gradient(90deg, #CA8A04, #FACC15)'
              : 'linear-gradient(90deg, #B91C1C, #EF4444)',
          }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-[#22C55E] text-base font-bold">{stats.completed}</p>
          <p className="text-[var(--ct2)] text-xs">Done</p>
        </div>
        <div className="text-center">
          <p className="text-[#EF4444] text-base font-bold">{stats.missed}</p>
          <p className="text-[var(--ct2)] text-xs">Missed</p>
        </div>
        <div className="text-center">
          <p className="text-[var(--ct1)] text-base font-bold">{remaining > 0 ? remaining : 0}</p>
          <p className="text-[var(--ct2)] text-xs">Left</p>
        </div>
      </div>

      {/* Per-exercise reps row */}
      {(() => {
        const pushupLabel = customExerciseLabels?.['pushups'] ?? 'Push-ups';
        const squatLabel  = customExerciseLabels?.['squats']  ?? 'Squats';
        const plankLabel  = customExerciseLabels?.['situps']  ?? 'Plank';
        const customEntries = Object.entries(customExerciseLabels ?? {})
          .filter(([key]) => key.startsWith('custom_') && enabledExercises?.[key] !== false)
          .map(([key, label]) => ({
            key,
            label,
            trackingType: (customExerciseTrackingTypes?.[key] ?? 'reps') as 'reps' | 'time',
            value: stats.customExerciseStats?.[key] ?? 0,
          }))
          .filter(ex => ex.value > 0);

        const hasAny = stats.pushupReps > 0 || stats.squatReps > 0 || stats.situpReps > 0 || customEntries.length > 0;
        if (!hasAny) return null;

        return (
          <div className="flex flex-wrap justify-around gap-x-4 gap-y-2 mt-2 pt-2 border-t border-[var(--c4)]">
            {stats.pushupReps > 0 && enabledExercises?.['pushups'] !== false && (
              <div className="text-center">
                <p className="text-[#F97316] text-base font-bold">{stats.pushupReps}</p>
                <p className="text-[var(--ct2)] text-xs">{pushupLabel}</p>
              </div>
            )}
            {stats.squatReps > 0 && enabledExercises?.['squats'] !== false && (
              <div className="text-center">
                <p className="text-[#F97316] text-base font-bold">{stats.squatReps}</p>
                <p className="text-[var(--ct2)] text-xs">{squatLabel}</p>
              </div>
            )}
            {stats.situpReps > 0 && enabledExercises?.['situps'] !== false && (
              <div className="text-center">
                <p className="text-[#F97316] text-base font-bold">{stats.situpReps}s</p>
                <p className="text-[var(--ct2)] text-xs">{plankLabel}</p>
              </div>
            )}
            {customEntries.map(ex => {
              const isTime = ex.trackingType === 'time';
              const mins = Math.round(ex.value / 60);
              return (
                <div key={ex.key} className="text-center">
                  <p className="text-[#F97316] text-base font-bold">
                    {ex.value}
                    {isTime && <span className="text-xs font-semibold ml-0.5">min</span>}
                  </p>
                  <p className="text-[var(--ct2)] text-xs">{ex.label}</p>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
