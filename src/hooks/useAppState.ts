import { useState, useEffect, useCallback } from 'react';
import type { AppState, AppSettings, SessionLog, DailyStats } from '@/types';
import { loadSettings, saveSettings, loadLogs, saveLogs } from '@/lib/storage';
import { generateDaySessions, markPastSessionsMissed, sessionFireTime } from '@/lib/sessions';
import { computeDayStats } from '@/lib/compliance';
import { calculateStreak } from '@/lib/streak';
import { NotificationService, buildNotifications } from '@/lib/notifications';

const DEFAULT_SETTINGS: AppSettings = {
  progression: {
    startingReps: 10,
    increaseAmount: 2,
    increaseEveryDays: 3,
    maxReps: 50,
  },
  reminders: {
    scheduleMode: 'auto' as const,
    startHour: 9,
    startMinute: 0,
    endHour: 21,
    endMinute: 0,
    customMinutes: [],
    enabled: true,
    snoozeMinutes: 10,
    alertStyle: 'sound' as const,
    notificationSound: 'double-beep' as const,
  },
  deload: {
    complianceThreshold: 0.6,
    lookbackDays: 2,
    behavior: 'hold',
    reducePercent: 0.15,
  },
  experienceLevel: 'beginner',
  enabledExercises: { pushups: true, squats: true, situps: true },
  startDate: new Date().toISOString().split('T')[0],
  onboardingComplete: false,
};

export function useAppState() {
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [logs, setLogsState] = useState<Record<string, SessionLog>>({});
  const [initialized, setInitialized] = useState(false);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedSettings = loadSettings() as AppSettings | null;
    const savedLogs = loadLogs() as Record<string, SessionLog> | null;
    if (savedSettings) {
      let merged: AppSettings = { ...DEFAULT_SETTINGS, ...savedSettings };
      // Migrate single-team fields → teams[]
      if (!merged.teams && merged.teamName && merged.teamCode) {
        merged = {
          ...merged,
          teams: [{
            id: 'team-' + Date.now(),
            name: merged.teamName,
            code: merged.teamCode,
            isAdmin: !!merged.isTeamAdmin,
            members: merged.teamMembers ?? [],
            joinedAt: Date.now(),
          }],
          teamName: undefined,
          teamCode: undefined,
          isTeamAdmin: undefined,
          teamMembers: undefined,
        };
      }
      setSettingsState(merged);
    }
    if (savedLogs) setLogsState(savedLogs);
    setInitialized(true);
  }, []);

  // ── Persist on change ──────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized) saveSettings(settings);
  }, [settings, initialized]);

  useEffect(() => {
    if (initialized) saveLogs(logs);
  }, [logs, initialized]);


  // ── Derived helpers ────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  const activeDays = settings.activeDays ?? [0, 1, 2, 3, 4, 5, 6];
  const isActiveDay = (dateStr: string) => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    return activeDays.includes(new Date(y, mo - 1, d).getDay());
  };

  // Build allStats from logs for past days only — today uses the full resolved session list.
  // Rest days are excluded so they don't skew compliance or streak calculations.
  const pastStats: DailyStats[] = Object.values(
    Object.entries(logs)
      .filter(([, log]) => log.date !== today && isActiveDay(log.date))
      .reduce<Record<string, SessionLog[]>>((acc, [, log]) => {
        acc[log.date] = acc[log.date] || [];
        acc[log.date].push(log);
        return acc;
      }, {})
  ).map(dayLogs => computeDayStats(dayLogs[0].date, dayLogs, settings.customExerciseTrackingTypes));

  const todaySessions = generateDaySessions(today, settings, logs, pastStats);
  const todaySessionsResolved = markPastSessionsMissed(todaySessions);

  // Persist any newly-resolved sessions (missed/snoozed) back into logs
  // so the history screen can see them.
  useEffect(() => {
    if (!initialized) return;
    const updates: Record<string, SessionLog> = {};
    todaySessionsResolved.forEach(s => {
      const existing = logs[s.id];
      if (!existing || existing.status !== s.status) {
        updates[s.id] = s;
      }
    });
    if (Object.keys(updates).length > 0) {
      setLogsState(prev => ({ ...prev, ...updates }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, todaySessionsResolved.map(s => `${s.id}:${s.status}`).join(',')]);

  const todayStats = computeDayStats(today, todaySessionsResolved, settings.customExerciseTrackingTypes);

  // allStats includes today's full session list so compliance is accurate.
  // Today is only included if it's an active day — rest days don't count toward stats.
  const allStats: DailyStats[] = [
    ...pastStats.filter(s => s.date !== today),
    ...(isActiveDay(today) ? [todayStats] : []),
  ];
  const streak = calculateStreak(allStats, settings.deload.complianceThreshold, settings.activeDays);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const completeSession = useCallback((
    id: string,
    completedReps: number,
    completedSquatReps: number,
    completedSitupReps: number,
    customExerciseReps: Record<string, number> = {},
  ) => {
    setLogsState(prev => ({
      ...prev,
      [id]: {
        ...todaySessionsResolved.find(s => s.id === id)!,
        ...prev[id],
        completedReps,
        completedSquatReps,
        completedSitupReps,
        customExerciseReps,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      },
    }));
  }, [todaySessionsResolved]);

  const undoSession = useCallback((id: string) => {
    setLogsState(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const skipSession = useCallback((id: string) => {
    const session = todaySessionsResolved.find(s => s.id === id)!;
    setLogsState(prev => ({
      ...prev,
      [id]: { ...session, ...prev[id], status: 'skipped', updatedAt: new Date().toISOString() },
    }));
  }, [todaySessionsResolved]);

  const snoozeSession = useCallback((id: string) => {
    const session = todaySessionsResolved.find(s => s.id === id)!;
    const snoozedUntil = new Date(
      Date.now() + settings.reminders.snoozeMinutes * 60_000
    ).toISOString();
    setLogsState(prev => ({
      ...prev,
      [id]: { ...session, ...prev[id], status: 'snoozed', snoozedUntil, updatedAt: new Date().toISOString() },
    }));
  }, [todaySessionsResolved, settings.reminders.snoozeMinutes]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettingsState(prev => ({ ...prev, ...partial }));
  }, []);

  const resetProgress = useCallback(() => {
    setLogsState({});
    setSettingsState({
      ...DEFAULT_SETTINGS,
      startDate: new Date().toISOString().split('T')[0],
      onboardingComplete: false,
    });
  }, []);

  const scheduleNotifications = useCallback(async () => {
    const notifs = buildNotifications(todaySessionsResolved, settings.reminders.alertStyle);
    await NotificationService.scheduleAll(notifs);
  }, [todaySessionsResolved, settings.reminders.alertStyle]);

  // ── Interval-based alarm check (reliable while tab is open) ────────────────
  useEffect(() => {
    if (!initialized || !settings.reminders.enabled || !settings.onboardingComplete) return;

    // Track which session IDs have already fired so we don't double-alert
    const fired = new Set<string>();

    const check = async () => {
      const now = new Date();
      const pending = todaySessionsResolved.filter(s => s.status === 'pending' && !fired.has(s.id));

      for (const s of pending) {
        const fireAt = sessionFireTime(s.date, s.scheduledHour, s.scheduledMinute ?? 0);
        // Fire if we're within 30 seconds past the scheduled time
        const diff = now.getTime() - fireAt.getTime();
        if (diff >= 0 && diff < 30_000) {
          fired.add(s.id);
          const granted = await NotificationService.requestPermission();
          if (granted) {
            new Notification('💪 Push-up time!', { body: `Time for push-ups: do ${s.targetReps} reps` });
          }
          NotificationService.triggerAlert(settings.reminders.alertStyle ?? 'sound', settings.reminders.notificationSound);
        }
      }
    };

    check(); // run immediately in case we just loaded at alarm time
    const id = setInterval(check, 15_000); // check every 15 seconds
    return () => clearInterval(id);
  }, [initialized, settings.reminders.enabled, settings.onboardingComplete,
      settings.reminders.alertStyle, todaySessionsResolved]);

  const testNotification = useCallback(async () => {
    const current = todaySessionsResolved.find(s => s.status === 'pending');
    const reps = current?.targetReps ?? settings.progression.startingReps;
    await NotificationService.sendImmediate(
      '💪 Push-up time!',
      `Time for push-ups: do ${reps} reps`
    );
    NotificationService.triggerAlert(settings.reminders.alertStyle ?? 'sound', settings.reminders.notificationSound);
  }, [todaySessionsResolved, settings.progression.startingReps, settings.reminders.alertStyle]);

  return {
    settings,
    logs,
    todaySessions: todaySessionsResolved,
    todayStats,
    allStats,
    streak,
    initialized,
    completeSession,
    undoSession,
    skipSession,
    snoozeSession,
    updateSettings,
    resetProgress,
    scheduleNotifications,
    testNotification,
  };
}
