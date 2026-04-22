import type { DailyStats } from '@/types';

interface InsightsProps {
  allStats: DailyStats[];
  streak: number;
}

function getLongestStreak(stats: DailyStats[], threshold = 0.6): number {
  const sorted = [...stats].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0, cur = 0;
  for (const s of sorted) {
    if (s.complianceRate >= threshold) { cur++; best = Math.max(best, cur); }
    else cur = 0;
  }
  return best;
}

function getMostActiveDay(stats: DailyStats[]): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totals = new Array(7).fill(0);
  for (const s of stats) {
    const [y, mo, d] = s.date.split('-').map(Number);
    const dow = new Date(y, mo - 1, d).getDay();
    totals[dow] += s.completed;
  }
  const max = Math.max(...totals);
  return max === 0 ? '—' : days[totals.indexOf(max)];
}

export function HistoryInsights({ allStats, streak }: InsightsProps) {
  const threshold = 0.6;
  const longest = getLongestStreak(allStats, threshold);
  const mostActive = getMostActiveDay(allStats);
  const avgRate = allStats.length
    ? Math.round(allStats.reduce((s, d) => s + d.complianceRate, 0) / allStats.length * 100)
    : 0;
  const totalReps = allStats.reduce((s, d) => s + d.totalReps, 0);

  const tiles = [
    { icon: '🔥', label: 'Current streak', value: `${streak}d`,    color: 'var(--ca)' },
    { icon: '🏆', label: 'Best streak',    value: `${longest}d`,   color: '#FACC15' },
    { icon: '📊', label: 'Avg. completion',value: `${avgRate}%`,   color: avgRate >= 60 ? '#22C55E' : '#EF4444' },
    { icon: '💪', label: 'All-time reps',  value: String(totalReps), color: '#22C55E' },
    { icon: '📅', label: 'Most active day',value: mostActive,       color: 'var(--ct1)' },
    { icon: '📈', label: 'Days tracked',   value: String(allStats.length), color: 'var(--ct1)' },
  ];

  return (
    <div className="space-y-3">
      <p className="text-[var(--ct0)] text-sm font-semibold">Insights</p>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(t => (
          <div key={t.label} className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-3 flex flex-col gap-1">
            <span className="text-base leading-none">{t.icon}</span>
            <p className="font-bold text-base leading-tight" style={{ color: t.color }}>{t.value}</p>
            <p className="text-[var(--ct2)] text-xs leading-tight">{t.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
