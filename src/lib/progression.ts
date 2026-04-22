import type { ProgressionSettings } from '@/types';

/**
 * Returns the raw (non-deloaded) target reps for a given day index.
 * dayIndex: 0 = first day of the program.
 */
export function getRawTargetReps(
  dayIndex: number,
  settings: ProgressionSettings
): number {
  const { startingReps, increaseAmount, increaseEveryDays, maxReps } = settings;
  const steps = Math.floor(dayIndex / increaseEveryDays);
  const reps = startingReps + steps * increaseAmount;
  return Math.min(reps, maxReps);
}

/**
 * Returns day index (0-based) from a start date to a given target date.
 */
export function getDayIndex(startDate: string, targetDate: string): number {
  const start = new Date(startDate).getTime();
  const target = new Date(targetDate).getTime();
  return Math.max(0, Math.floor((target - start) / 86_400_000));
}
