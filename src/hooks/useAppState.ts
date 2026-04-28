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
  const [cloudSynced, setCloudSynced] = useState(false);

  // ── Bootstrap: load localStorage first, then overlay cloud data ───────────
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

  // ── Cloud fetch: overlay Supabase data on top of localStorage ─────────────
  useEffect(() => {
    if (!initialized) return;
    const timeout = setTimeout(() => setCloudSynced(true), 5_000);
    fetch('/api/sync')
      .then(r => r.ok ? r.json() : null)
      .then(cloud => {
        if (!cloud) return;
        if (cloud.settings) {
          // Don't overwrite settings if the user made a local change in the last 30 seconds
          const lastLocalChange = parseInt(localStorage.getItem('puh_local_update') ?? '0', 10);
          const secondsSinceLocalChange = (Date.now() - lastLocalChange) / 1000;
          if (secondsSinceLocalChange > 30) {
            const merged = { ...DEFAULT_SETTINGS, ...cloud.settings };
            setSettingsState(merged);
            saveSettings(merged);
          }
        }
        if (cloud.logs) {
          setLogsState(cloud.logs);
          saveLogs(cloud.logs);
        }
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timeout); setCloudSynced(true); });
    return () => clearTimeout(timeout);
  }, [initialized]);

  // ── Persist to localStorage immediately on every change ───────────────────
  useEffect(() => {
    if (initialized) saveSettings(settings);
  }, [settings, initialized]);

  useEffect(() => {
    if (initialized) saveLogs(logs);
  }, [logs, initialized]);

  // ── Debounced write to Supabase (1.5 s after last change) ─────────────────
  useEffect(() => {
    if (!initialized || !cloudSynced) return;
    const t = setTimeout(() => {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      }).catch(() => {});
    }, 1_500);
    return () => clearTimeout(t);
  }, [settings, initialized, cloudSynced]);

  useEffect(() => {
    if (!initialized || !cloudSynced) return;
    const t = setTimeout(() => {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs }),
      }).catch(() => {});
    }, 1_500);
    return () => clearTimeout(t);
  }, [logs, initialized, cloudSynced]);


  // ── Derived helpers ────────────────────────────────────────────────────────
  // Use local date (not UTC) so day-of-week checks match the user's calendar.
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

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
  const streak = calculateStreak(allStats, settings.deload.complianceThreshold, settings.activeDays, settings.pausedUntil);
  const todayIsRestDay = !isActiveDay(today);
  const todayIsPaused = !!(settings.pausedUntil && today <= settings.pausedUntil);

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
    localStorage.setItem('puh_local_update', String(Date.now()));
    setSettingsState(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
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
            const enabledEx = settings.enabledExercises ?? { pushups: true, squats: true };
            const exerciseNames: string[] = [];
            if (enabledEx.pushups) exerciseNames.push(settings.customExerciseLabels?.['pushups'] ?? 'push-ups');
            if (enabledEx.squats) exerciseNames.push(settings.customExerciseLabels?.['squats'] ?? 'squats');
            if (enabledEx.situps) exerciseNames.push(settings.customExerciseLabels?.['situps'] ?? 'plank');
            Object.entries(settings.customExerciseLabels ?? {}).forEach(([key, label]) => {
              if (key.startsWith('custom_') && enabledEx[key] !== false) exerciseNames.push(label);
            });
            const exText = exerciseNames.length > 0 ? exerciseNames.join(', ') : 'exercises';
            new Notification('💪 Break time!', { body: `Time for ${exText} — ${s.targetReps} reps` });
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
    const enabledEx = settings.enabledExercises ?? { pushups: true, squats: true };
    const exerciseNames: string[] = [];
    if (enabledEx.pushups) exerciseNames.push(settings.customExerciseLabels?.['pushups'] ?? 'push-ups');
    if (enabledEx.squats) exerciseNames.push(settings.customExerciseLabels?.['squats'] ?? 'squats');
    if (enabledEx.situps) exerciseNames.push(settings.customExerciseLabels?.['situps'] ?? 'plank');
    Object.entries(settings.customExerciseLabels ?? {}).forEach(([key, label]) => {
      if (key.startsWith('custom_') && enabledEx[key] !== false) exerciseNames.push(label);
    });
    const exText = exerciseNames.length > 0 ? exerciseNames.join(', ') : 'exercises';
    await NotificationService.sendImmediate('💪 Break time!', `Time for ${exText} — ${reps} reps`);
    NotificationService.triggerAlert(settings.reminders.alertStyle ?? 'sound', settings.reminders.notificationSound);
  }, [todaySessionsResolved, settings.progression.startingReps, settings.reminders.alertStyle, settings.enabledExercises, settings.customExerciseLabels]);

  return {
    settings,
    logs,
    todaySessions: todaySessionsResolved,
    todayStats,
    allStats,
    streak,
    todayIsRestDay,
    todayIsPaused,
    initialized,
    cloudSynced,
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
