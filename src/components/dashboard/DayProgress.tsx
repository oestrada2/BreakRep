import type { DailyStats } from '@/types';

interface DayProgressProps {
  stats: DailyStats;
  targetReps: number;
}

export function DayProgress({ stats, targetReps }: DayProgressProps) {
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
      {stats.totalReps > 0 && (
        <div className="flex justify-around mt-2">
          {stats.pushupReps > 0 && (
            <div className="text-center">
              <p className="text-[#F97316] text-base font-bold">{stats.pushupReps}</p>
              <p className="text-[var(--ct2)] text-xs">Push-ups</p>
            </div>
          )}
          {stats.squatReps > 0 && (
            <div className="text-center">
              <p className="text-[#F97316] text-base font-bold">{stats.squatReps}</p>
              <p className="text-[var(--ct2)] text-xs">Squats</p>
            </div>
          )}
          {stats.situpReps > 0 && (
            <div className="text-center">
              <p className="text-[#F97316] text-base font-bold">{stats.situpReps}s</p>
              <p className="text-[var(--ct2)] text-xs">Plank</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
