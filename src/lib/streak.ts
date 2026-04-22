import type { DailyStats } from '@/types';

/**
 * Returns the current streak of days with complianceRate >= threshold.
 * Days are ordered newest-first.
 */
export function calculateStreak(
  stats: DailyStats[],
  threshold: number = 0.6
): number {
  const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const day of sorted) {
    if (day.complianceRate >= threshold) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
