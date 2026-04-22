import type { DailyStats } from '@/types';

interface StatsPanelProps {
  todayStats: DailyStats;
  streak: number;
  weeklyCompliance: number;
  tomorrowReps: number;
  planStatus: string;
  allStats: DailyStats[];
}

export function StatsPanel({ todayStats, streak, weeklyCompliance, tomorrowReps, planStatus, allStats }: StatsPanelProps) {
  const weeklyReps = allStats
    .filter(s => s.date >= new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0])
    .reduce((sum, s) => sum + s.totalReps, 0);

  const bestDay = allStats.reduce((best, s) => s.totalReps > best ? s.totalReps : best, 0);

  const tiles = [
    { label: 'Streak',       value: `${streak}d`,                              accent: 'var(--ca)', icon: '🔥' },
    { label: 'Weekly reps',  value: String(weeklyReps),                         accent: '#22C55E', icon: '📈' },
    { label: 'Weekly rate',  value: `${Math.round(weeklyCompliance * 100)}%`,   accent: '#22C55E', icon: '✅' },
    { label: 'Personal best',value: `${bestDay} reps`,                          accent: '#FACC15', icon: '🏆' },
  ];

  const PLAN_LABELS: Record<string, { label: string; color: string }> = {
    progressing: { label: 'Progressing',   color: '#22C55E' },
    holding:     { label: 'Holding Steady', color: '#FACC15' },
    deloading:   { label: 'Deload Active',  color: '#FB923C' },
  };
  const plan = PLAN_LABELS[planStatus] ?? { label: planStatus, color: 'var(--ct1)' };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[var(--ct0)] text-sm font-semibold">Stats</p>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: plan.color, background: `${plan.color}18` }}>
          {plan.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {tiles.map(t => (
          <div key={t.label} className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base leading-none">{t.icon}</span>
              <p className="text-[var(--ct2)] text-xs">{t.label}</p>
            </div>
            <p className="text-lg font-bold" style={{ color: t.accent }}>{t.value}</p>
          </div>
        ))}
      </div>

      {/* Tomorrow preview */}
      <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <p className="text-[var(--ct1)] text-xs">Tomorrow's target</p>
        </div>
        <p className="text-[var(--ct0)] text-sm font-bold">{tomorrowReps} reps</p>
      </div>
    </div>
  );
}
