import type { DailyStats } from '@/types';

interface RepsChartProps {
  stats: DailyStats[];
}

const EMOJI = (pct: number) => {
  if (pct >= 90) return '🔥';
  if (pct >= 60) return '💪';
  if (pct >= 30) return '😅';
  return '💤';
};

export function RepsChart({ stats }: RepsChartProps) {
  const days = [...stats]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);

  if (days.length === 0) {
    return (
      <div className="bg-[var(--c4)] border border-[var(--c5)] rounded-lg p-4">
        <h2 className="text-[var(--ct0)] font-semibold text-sm uppercase tracking-wide mb-4">This week</h2>
        <p className="text-[var(--ct1)] text-sm text-center py-6">No sessions yet — get started!</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--c4)] border border-[var(--c5)] rounded-lg p-4">
      <h2 className="text-[var(--ct0)] font-semibold text-sm uppercase tracking-wide mb-4">This week</h2>
      <div className="space-y-3">
        {days.map(s => {
          const pct = Math.round(s.complianceRate * 100);
          const color = pct >= 60 ? '#22C55E' : pct >= 30 ? '#FACC15' : '#EF4444';
          const dayLabel = new Date(...(s.date.split('-').map(Number) as [number, number, number]))
            .toLocaleDateString('en-US', { weekday: 'short' });

          return (
            <div key={s.date}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[var(--ct1)] text-xs w-8">{dayLabel}</span>
                <span className="text-xs text-[var(--ct1)] flex-1 ml-2">
                  {s.totalReps} reps · {s.completed}/{s.totalSessions} sessions
                </span>
                <span className="text-base leading-none ml-2">{EMOJI(pct)}</span>
                <span className="text-xs font-bold ml-2 w-10 text-right" style={{ color }}>{pct}%</span>
              </div>
              <div className="w-full bg-[var(--c5)] rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
