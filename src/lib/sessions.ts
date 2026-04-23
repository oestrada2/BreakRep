import type { SessionLog, AppSettings } from '@/types';
import { getPlanStatusForDate } from './compliance';
import type { DailyStats } from '@/types';

/**
 * Generates the scheduled session list for a single day.
 *
 * auto mode:   one session per hour at startMinute, from startHour to endHour.
 * custom mode: one session per entry in customTimes (sorted "HH:MM" strings).
 *
 * Does NOT overwrite existing logs — only fills in missing slots.
 */
export function generateDaySessions(
  date: string,
  settings: AppSettings,
  existingLogs: Record<string, SessionLog>,
  allStats: DailyStats[]
): SessionLog[] {
  const r = settings.reminders;
  const { reps } = getPlanStatusForDate(date, settings, allStats);

  // Build the list of {hour, minute} slots for the day
  const slots: { hour: number; minute: number }[] = [];

  const overnight = r.endHour < r.startHour;

  if (r.scheduleMode === 'custom') {
    const minutes  = [...(r.customMinutes ?? [])].sort((a, b) => a - b);
    const startTotal = r.startHour * 60 + (r.startMinute ?? 0);
    const endTotal   = r.endHour   * 60 + (r.endMinute   ?? 0);

    if (overnight) {
      // Evening block FIRST (startHour → 23) — start of the user's window
      for (let hour = r.startHour; hour <= 23; hour++) {
        for (const minute of minutes) {
          if (hour * 60 + minute >= startTotal) slots.push({ hour, minute });
        }
      }
      // Early morning block SECOND (0 → endHour) — end of the user's window
      for (let hour = 0; hour <= r.endHour; hour++) {
        for (const minute of minutes) {
          if (hour * 60 + minute <= endTotal) slots.push({ hour, minute });
        }
      }
    } else {
      for (let hour = r.startHour; hour <= r.endHour; hour++) {
        for (const minute of minutes) {
          const total = hour * 60 + minute;
          if (total >= startTotal && total <= endTotal) slots.push({ hour, minute });
        }
      }
    }
  } else {
    const startMinute = r.startMinute ?? 0;
    const endMinute   = r.endMinute   ?? 0;

    if (overnight) {
      // Evening block FIRST (startHour → 23) — start of the user's window
      for (let hour = r.startHour; hour <= 23; hour++) {
        slots.push({ hour, minute: startMinute });
      }
      // Early morning block SECOND (0 → endHour) — end of the user's window
      for (let hour = 0; hour <= r.endHour; hour++) {
        if (hour === r.endHour && startMinute > endMinute) continue;
        slots.push({ hour, minute: startMinute });
      }
    } else {
      for (let hour = r.startHour; hour <= r.endHour; hour++) {
        if (hour === r.endHour && startMinute > endMinute) continue;
        slots.push({ hour, minute: startMinute });
      }
    }
  }

  return slots.map(({ hour, minute }) => {
    const id = `${date}-${String(hour).padStart(2, '0')}-${String(minute).padStart(2, '0')}`;
    const legacyId = `${date}-${String(hour).padStart(2, '0')}`;
    const existing = existingLogs[id] ?? existingLogs[legacyId];

    if (existing) {
      return { ...existing, id, scheduledHour: hour, scheduledMinute: minute };
    }

    return {
      id,
      date,
      scheduledHour: hour,
      scheduledMinute: minute,
      targetReps: reps,
      completedReps: null,
      completedSquatReps: null,
      completedSitupReps: null,
      status: 'pending' as const,
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Build a local-time Date for a session's scheduled moment.
 * IMPORTANT: new Date('YYYY-MM-DD') is UTC midnight — using setHours() on it
 * gives the wrong local time. Parse the date parts manually instead.
 */
export function sessionFireTime(date: string, hour: number, minute: number = 0): Date {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y, mo - 1, d, hour, minute, 0, 0);
}

/**
 * Marks all pending sessions before the current time as missed.
 */
export function markPastSessionsMissed(
  sessions: SessionLog[],
  now: Date = new Date()
): SessionLog[] {
  return sessions.map(s => {
    if (s.status !== 'pending') return s;
    const sessionTime = sessionFireTime(s.date, s.scheduledHour, s.scheduledMinute ?? 0);
    if (sessionTime < now) {
      return { ...s, status: 'missed', updatedAt: now.toISOString() };
    }
    return s;
  });
}

export function formatTime(hour: number, minute: number = 0): string {
  const ampm = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${h}:00 ${ampm}` : `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
}

/** @deprecated use formatTime */
export function formatHour(hour: number): string {
  return formatTime(hour, 0);
}
