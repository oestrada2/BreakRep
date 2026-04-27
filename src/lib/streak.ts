import type { DailyStats } from '@/types';

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns the current streak of consecutive active days meeting the threshold.
 * Rest days (not in activeDays) are skipped — they neither add nor break the streak.
 */
export function calculateStreak(
  stats: DailyStats[],
  threshold: number = 0.6,
  activeDays: number[] = [0, 1, 2, 3, 4, 5, 6]
): number {
  if (activeDays.length === 0) return 0;

  const statsMap = new Map(stats.map(s => [s.date, s]));
  const todayStr = toISO(new Date());
  const cur = new Date();
  let streak = 0;

  for (let guard = 0; guard < 730; guard++) {
    const dateStr = toISO(cur);
    const dow = cur.getDay();

    if (!activeDays.includes(dow)) {
      cur.setDate(cur.getDate() - 1);
      continue;
    }

    const stat = statsMap.get(dateStr);

    // Don't penalize today if it hasn't started yet
    if (dateStr === todayStr && !stat) {
      cur.setDate(cur.getDate() - 1);
      continue;
    }

    if (!stat || stat.complianceRate < threshold) break;

    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  return streak;
}
