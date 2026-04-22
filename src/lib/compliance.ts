import type { DailyStats, DeloadSettings, AppSettings } from '@/types';
import { getRawTargetReps, getDayIndex } from './progression';

export type PlanStatus = 'progressing' | 'holding' | 'deloading';

/**
 * Calculates compliance rate for a single day.
 */
export function getDayCompliance(stats: DailyStats): number {
  if (stats.totalSessions === 0) return 1;
  return stats.completed / stats.totalSessions;
}

/**
 * Given the last N days of DailyStats, determine plan status and adjusted reps.
 */
export function getAdjustedReps(
  baseReps: number,
  recentStats: DailyStats[],
  deload: DeloadSettings
): { reps: number; status: PlanStatus } {
  if (recentStats.length === 0) return { reps: baseReps, status: 'progressing' };

  const avgCompliance =
    recentStats.reduce((sum, s) => sum + getDayCompliance(s), 0) /
    recentStats.length;

  if (avgCompliance >= deload.complianceThreshold) {
    return { reps: baseReps, status: 'progressing' };
  }

  if (deload.behavior === 'hold') {
    return { reps: baseReps, status: 'holding' };
  }

  const reduced = Math.round(baseReps * (1 - deload.reducePercent));
  return { reps: reduced, status: 'deloading' };
}

/**
 * Compute daily stats from a flat list of logs filtered to a specific date.
 */
export function computeDayStats(
  date: string,
  logs: Array<{ status: string; completedReps?: number | null; completedSquatReps?: number | null; completedSitupReps?: number | null }>
): DailyStats {
  const total = logs.length;
  const completed = logs.filter(l => l.status === 'completed').length;
  const missed = logs.filter(l => l.status === 'missed').length;
  const skipped = logs.filter(l => l.status === 'skipped').length;
  const snoozed = logs.filter(l => l.status === 'snoozed').length;
  const totalReps = logs.reduce((sum, l) => {
    if (l.status !== 'completed') return sum;
    return sum + (l.completedReps ?? 0) + (l.completedSquatReps ?? 0) + (l.completedSitupReps ?? 0);
  }, 0);

  return {
    date,
    totalSessions: total,
    completed,
    missed,
    skipped,
    snoozed,
    complianceRate: total > 0 ? completed / total : 1,
    totalReps,
  };
}

/**
 * Full plan status for a given date, factoring in deload.
 */
export function getPlanStatusForDate(
  date: string,
  settings: AppSettings,
  allStats: DailyStats[]
): { reps: number; status: PlanStatus } {
  const dayIndex = getDayIndex(settings.startDate, date);
  const baseReps = getRawTargetReps(dayIndex, settings.progression);

  // Look at the N days *before* today for compliance
  const lookback = settings.deload.lookbackDays;
  const recentStats = allStats
    .filter(s => s.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, lookback);

  return getAdjustedReps(baseReps, recentStats, settings.deload);
}
