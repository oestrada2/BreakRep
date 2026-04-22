# PushUp Hourly — Complete Codebase

## File Structure

```
pushhour/
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── capacitor.config.ts          ← pre-wired, fill in after init
├── public/
│   └── icons/                   ← add your app icons here
├── src/
│   ├── types/
│   │   └── index.ts             ← all TypeScript types
│   ├── lib/
│   │   ├── storage.ts           ← IndexedDB wrapper
│   │   ├── progression.ts       ← rep calculation logic
│   │   ├── compliance.ts        ← compliance + deload logic
│   │   ├── sessions.ts          ← session generation
│   │   ├── streak.ts            ← streak calculation
│   │   └── notifications.ts     ← notification service (Capacitor-ready)
│   ├── hooks/
│   │   ├── useAppState.ts       ← root state hook
│   │   └── useCountdown.ts      ← next-reminder countdown
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx
│   │   │   └── NavTabs.tsx
│   │   ├── dashboard/
│   │   │   ├── SessionList.tsx
│   │   │   ├── StatsPanel.tsx
│   │   │   ├── ComplianceChart.tsx
│   │   │   └── RepsChart.tsx
│   │   ├── sessions/
│   │   │   ├── SessionCard.tsx
│   │   │   └── LogEditor.tsx
│   │   ├── settings/
│   │   │   └── SettingsForm.tsx
│   │   ├── onboarding/
│   │   │   └── OnboardingWizard.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Badge.tsx
│   │       └── Modal.tsx
│   └── pages/
│       ├── _app.tsx
│       ├── index.tsx            ← dashboard
│       ├── logs.tsx             ← session log history
│       └── settings.tsx
```

---

## src/types/index.ts

```typescript
export type SessionStatus = 'pending' | 'completed' | 'missed' | 'skipped' | 'snoozed';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type DeloadBehavior = 'hold' | 'reduce';

export interface ProgressionSettings {
  startingReps: number;
  increaseAmount: number;
  increaseEveryDays: number;
  maxReps: number;
}

export interface ReminderSettings {
  startHour: number;   // 0–23
  endHour: number;     // 0–23
  enabled: boolean;
  snoozeMinutes: number;
}

export interface DeloadSettings {
  complianceThreshold: number;   // default 0.6
  lookbackDays: number;          // default 2
  behavior: DeloadBehavior;
  reducePercent: number;         // default 0.15 (15%)
}

export interface AppSettings {
  progression: ProgressionSettings;
  reminders: ReminderSettings;
  deload: DeloadSettings;
  experienceLevel: ExperienceLevel;
  startDate: string;             // ISO date string YYYY-MM-DD
  onboardingComplete: boolean;
}

export interface SessionLog {
  id: string;                    // `${date}-${hour}` e.g. "2025-01-15-09"
  date: string;                  // YYYY-MM-DD
  scheduledHour: number;         // 9–21
  targetReps: number;
  completedReps: number | null;
  status: SessionStatus;
  snoozedUntil?: string;         // ISO datetime
  notes?: string;
  updatedAt: string;             // ISO datetime
}

export interface DayPlan {
  date: string;
  targetReps: number;
  planStatus: 'progressing' | 'holding' | 'deloading';
  sessions: SessionLog[];
}

export interface DailyStats {
  date: string;
  totalSessions: number;
  completed: number;
  missed: number;
  skipped: number;
  snoozed: number;
  complianceRate: number;        // 0.0–1.0
}

export interface AppState {
  settings: AppSettings;
  logs: Record<string, SessionLog>;   // keyed by SessionLog.id
  initialized: boolean;
}
```

---

## src/lib/storage.ts

```typescript
/**
 * Thin localStorage wrapper.
 * For production, swap the body of each function with IndexedDB calls.
 * All keys are namespaced under "puh_" to avoid collisions.
 */

const KEYS = {
  SETTINGS: 'puh_settings',
  LOGS: 'puh_logs',
} as const;

export function saveSettings(settings: object): void {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export function loadSettings(): object | null {
  const raw = localStorage.getItem(KEYS.SETTINGS);
  return raw ? JSON.parse(raw) : null;
}

export function saveLogs(logs: object): void {
  localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
}

export function loadLogs(): object | null {
  const raw = localStorage.getItem(KEYS.LOGS);
  return raw ? JSON.parse(raw) : null;
}

export function clearAll(): void {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
```

---

## src/lib/progression.ts

```typescript
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
```

---

## src/lib/compliance.ts

```typescript
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
  logs: Array<{ status: string }>
): DailyStats {
  const total = logs.length;
  const completed = logs.filter(l => l.status === 'completed').length;
  const missed = logs.filter(l => l.status === 'missed').length;
  const skipped = logs.filter(l => l.status === 'skipped').length;
  const snoozed = logs.filter(l => l.status === 'snoozed').length;

  return {
    date,
    totalSessions: total,
    completed,
    missed,
    skipped,
    snoozed,
    complianceRate: total > 0 ? completed / total : 1,
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
```

---

## src/lib/sessions.ts

```typescript
import type { SessionLog, AppSettings } from '@/types';
import { getPlanStatusForDate } from './compliance';
import type { DailyStats } from '@/types';
import { v4 as uuidv4 } from 'uuid'; // or use a simple timestamp ID

/**
 * Generates the scheduled session list for a single day.
 * Does NOT overwrite existing logs — only fills in missing slots.
 */
export function generateDaySessions(
  date: string,
  settings: AppSettings,
  existingLogs: Record<string, SessionLog>,
  allStats: DailyStats[]
): SessionLog[] {
  const { startHour, endHour } = settings.reminders;
  const { reps } = getPlanStatusForDate(date, settings, allStats);

  const sessions: SessionLog[] = [];

  for (let hour = startHour; hour <= endHour; hour++) {
    const id = `${date}-${String(hour).padStart(2, '0')}`;
    if (existingLogs[id]) {
      sessions.push(existingLogs[id]);
      continue;
    }

    sessions.push({
      id,
      date,
      scheduledHour: hour,
      targetReps: reps,
      completedReps: null,
      status: 'pending',
      updatedAt: new Date().toISOString(),
    });
  }

  return sessions;
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
    const sessionTime = new Date(s.date);
    sessionTime.setHours(s.scheduledHour, 0, 0, 0);
    if (sessionTime < now) {
      return { ...s, status: 'missed', updatedAt: now.toISOString() };
    }
    return s;
  });
}

export function formatHour(hour: number): string {
  const ampm = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${ampm}`;
}
```

---

## src/lib/streak.ts

```typescript
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
```

---

## src/lib/notifications.ts

```typescript
/**
 * Notification Service — Capacitor-ready abstraction.
 *
 * HOW THIS WORKS NOW (browser):
 *   Uses the Web Notifications API as a development stand-in.
 *   This will show notifications when the tab is open.
 *
 * HOW TO WIRE IN CAPACITOR (production Android):
 *   1. `npm install @capacitor/local-notifications`
 *   2. Replace the BROWSER SECTION below with the CAPACITOR SECTION.
 *   3. Call NotificationService.scheduleAll() after loading app state.
 *
 * LIMITATION OF BROWSER NOTIFICATIONS:
 *   - Only fire while the browser tab is open and focused (or in background on some browsers).
 *   - Cannot wake a sleeping Android device.
 *   - Cannot fire after the user closes the browser.
 *   Native Android local notifications via Capacitor DO NOT have these limitations.
 */

export interface ScheduledNotification {
  id: number;
  title: string;
  body: string;
  fireAt: Date;
}

// ─── BROWSER SECTION ─────────────────────────────────────────────────────────

async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

async function scheduleAll(notifications: ScheduledNotification[]): Promise<void> {
  const granted = await requestPermission();
  if (!granted) {
    console.warn('[Notifications] Permission denied.');
    return;
  }

  // Browser: use setTimeout as a dev-only stand-in
  // REPLACE THIS ENTIRE BLOCK with Capacitor in production ↓
  notifications.forEach(n => {
    const delay = n.fireAt.getTime() - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        new Notification(n.title, { body: n.body });
      }, delay);
    }
  });
  // ↑ CAPACITOR REPLACEMENT:
  // import { LocalNotifications } from '@capacitor/local-notifications';
  // await LocalNotifications.schedule({
  //   notifications: notifications.map(n => ({
  //     id: n.id,
  //     title: n.title,
  //     body: n.body,
  //     schedule: { at: n.fireAt },
  //     sound: undefined,
  //     attachments: undefined,
  //     actionTypeId: '',
  //     extra: null,
  //   }))
  // });
}

async function cancelAll(): Promise<void> {
  // Browser: no reliable way to cancel scheduled setTimeouts globally.
  // CAPACITOR REPLACEMENT:
  // import { LocalNotifications } from '@capacitor/local-notifications';
  // const pending = await LocalNotifications.getPending();
  // await LocalNotifications.cancel(pending);
  console.info('[Notifications] cancelAll() called — no-op in browser mode.');
}

async function sendImmediate(title: string, body: string): Promise<void> {
  const granted = await requestPermission();
  if (!granted) return;
  new Notification(title, { body });
  // CAPACITOR REPLACEMENT:
  // await LocalNotifications.schedule({
  //   notifications: [{ id: Date.now(), title, body, schedule: { at: new Date(Date.now() + 500) } }]
  // });
}

export const NotificationService = {
  requestPermission,
  scheduleAll,
  cancelAll,
  sendImmediate,
};

// ─── HELPER: Build notification list from sessions ────────────────────────────

import type { SessionLog } from '@/types';

export function buildNotifications(sessions: SessionLog[]): ScheduledNotification[] {
  return sessions
    .filter(s => s.status === 'pending')
    .map(s => {
      const fireAt = new Date(s.date);
      fireAt.setHours(s.scheduledHour, 0, 0, 0);
      return {
        id: parseInt(s.id.replace(/-/g, '').replace(/^0+/, ''), 10) % 2_147_483_647,
        title: '💪 Push-up time!',
        body: `Time for push-ups: do ${s.targetReps} reps`,
        fireAt,
      };
    })
    .filter(n => n.fireAt > new Date());
}
```

---

## src/hooks/useAppState.ts

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { AppState, AppSettings, SessionLog, DailyStats } from '@/types';
import { loadSettings, saveSettings, loadLogs, saveLogs } from '@/lib/storage';
import { generateDaySessions, markPastSessionsMissed } from '@/lib/sessions';
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
    startHour: 9,
    endHour: 21,
    enabled: true,
    snoozeMinutes: 10,
  },
  deload: {
    complianceThreshold: 0.6,
    lookbackDays: 2,
    behavior: 'hold',
    reducePercent: 0.15,
  },
  experienceLevel: 'beginner',
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
    if (savedSettings) setSettingsState(savedSettings);
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

  const allStats: DailyStats[] = Object.values(
    Object.entries(logs).reduce<Record<string, SessionLog[]>>((acc, [, log]) => {
      acc[log.date] = acc[log.date] || [];
      acc[log.date].push(log);
      return acc;
    }, {})
  ).map(dayLogs => computeDayStats(dayLogs[0].date, dayLogs));

  const todaySessions = generateDaySessions(today, settings, logs, allStats);
  const todaySessionsResolved = markPastSessionsMissed(todaySessions);

  const todayStats = computeDayStats(today, todaySessionsResolved);
  const streak = calculateStreak(allStats, settings.deload.complianceThreshold);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const completeSession = useCallback((id: string, completedReps: number) => {
    setLogsState(prev => ({
      ...prev,
      [id]: {
        ...todaySessionsResolved.find(s => s.id === id)!,
        ...prev[id],
        completedReps,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      },
    }));
  }, [todaySessionsResolved]);

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
    setSettingsState(prev => ({
      ...prev,
      startDate: new Date().toISOString().split('T')[0],
    }));
  }, []);

  const scheduleNotifications = useCallback(async () => {
    const notifs = buildNotifications(todaySessionsResolved);
    await NotificationService.scheduleAll(notifs);
  }, [todaySessionsResolved]);

  const testNotification = useCallback(async () => {
    const current = todaySessionsResolved.find(s => s.status === 'pending');
    const reps = current?.targetReps ?? settings.progression.startingReps;
    await NotificationService.sendImmediate(
      '💪 Push-up time!',
      `Time for push-ups: do ${reps} reps`
    );
  }, [todaySessionsResolved, settings.progression.startingReps]);

  return {
    settings,
    logs,
    todaySessions: todaySessionsResolved,
    todayStats,
    allStats,
    streak,
    initialized,
    completeSession,
    skipSession,
    snoozeSession,
    updateSettings,
    resetProgress,
    scheduleNotifications,
    testNotification,
  };
}
```

---

## src/hooks/useCountdown.ts

```typescript
import { useState, useEffect } from 'react';
import type { SessionLog } from '@/types';

/**
 * Returns a formatted countdown string to the next pending session.
 */
export function useCountdown(sessions: SessionLog[]): string {
  const [display, setDisplay] = useState('—');

  useEffect(() => {
    const nextPending = sessions
      .filter(s => s.status === 'pending' || s.status === 'snoozed')
      .map(s => {
        const d = new Date(s.date);
        if (s.status === 'snoozed' && s.snoozedUntil) {
          return new Date(s.snoozedUntil).getTime();
        }
        d.setHours(s.scheduledHour, 0, 0, 0);
        return d.getTime();
      })
      .filter(t => t > Date.now())
      .sort((a, b) => a - b)[0];

    if (!nextPending) {
      setDisplay('Done for today');
      return;
    }

    const tick = () => {
      const diff = nextPending - Date.now();
      if (diff <= 0) { setDisplay('Now'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(
        h > 0
          ? `${h}h ${String(m).padStart(2, '0')}m`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [sessions]);

  return display;
}
```

---

## src/components/ui/Button.tsx

```tsx
import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';  // see below

type Variant = 'complete' | 'snooze' | 'skip' | 'destructive' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  complete:    'bg-[#22C55E] hover:bg-[#16A34A] active:bg-[#15803D] text-white',
  snooze:      'bg-[#FACC15] hover:bg-[#EAB308] active:bg-[#CA8A04] text-black',
  skip:        'bg-[#FB923C] hover:bg-[#EA580C] active:bg-[#C2410C] text-white',
  destructive: 'bg-[#EF4444] hover:bg-[#DC2626] active:bg-[#B91C1C] text-white',
  secondary:   'bg-[#38BDF8] hover:bg-[#0EA5E9] active:bg-[#0284C7] text-black',
  ghost:       'bg-transparent border border-[#163A5F] hover:bg-[#163A5F] text-[#A9C1E8]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'ghost', size = 'md', className, ...props }: ButtonProps) {
  const sizes = { sm: 'px-3 py-1 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button
      className={cn(
        'rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
```

---

## src/components/ui/Badge.tsx

```tsx
type BadgeVariant = 'completed' | 'missed' | 'skipped' | 'snoozed' | 'pending';

const COLORS: Record<BadgeVariant, string> = {
  completed: 'bg-[#22C55E]/20 text-[#22C55E]',
  missed:    'bg-[#EF4444]/20 text-[#EF4444]',
  skipped:   'bg-[#FB923C]/20 text-[#FB923C]',
  snoozed:   'bg-[#FACC15]/20 text-[#FACC15]',
  pending:   'bg-[#163A5F] text-[#A9C1E8]',
};

export function Badge({ status }: { status: BadgeVariant }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${COLORS[status]}`}>
      {status}
    </span>
  );
}
```

---

## src/components/layout/TopBar.tsx

```tsx
import { useCountdown } from '@/hooks/useCountdown';
import type { SessionLog } from '@/types';

interface TopBarProps {
  todayReps: number;
  sessions: SessionLog[];
  planStatus: string;
}

export function TopBar({ todayReps, sessions, planStatus }: TopBarProps) {
  const countdown = useCountdown(sessions);

  const statusColors: Record<string, string> = {
    progressing: 'text-[#22C55E]',
    holding: 'text-[#FACC15]',
    deloading: 'text-[#FB923C]',
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B1C2D] border-b border-[#163A5F] h-14 flex items-center px-4 gap-4">
      <span className="font-bold text-[#EAF2FF] text-lg tracking-tight">PushUp Hourly</span>
      <div className="flex-1" />
      <span className={`text-sm font-medium ${statusColors[planStatus] ?? 'text-[#A9C1E8]'}`}>
        {todayReps} reps/session
      </span>
      <span className="text-[#A9C1E8] text-sm">Next: <span className="text-[#EAF2FF] font-mono">{countdown}</span></span>
    </header>
  );
}
```

---

## src/components/dashboard/SessionList.tsx

```tsx
import type { SessionLog } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatHour } from '@/lib/sessions';
import { useState } from 'react';

interface SessionListProps {
  sessions: SessionLog[];
  onComplete: (id: string, reps: number) => void;
  onSkip: (id: string) => void;
  onSnooze: (id: string) => void;
}

export function SessionList({ sessions, onComplete, onSkip, onSnooze }: SessionListProps) {
  const [editReps, setEditReps] = useState<Record<string, string>>({});

  return (
    <div className="space-y-2">
      <h2 className="text-[#EAF2FF] font-semibold text-sm uppercase tracking-wide mb-3">Today's Sessions</h2>
      {sessions.map(s => {
        const isPending = s.status === 'pending' || s.status === 'snoozed';
        const repsInput = editReps[s.id] ?? String(s.targetReps);

        return (
          <div
            key={s.id}
            className="bg-[#112A46] rounded-lg p-3 flex items-center gap-3 border border-[#163A5F]"
          >
            <div className="w-14 text-center">
              <p className="text-xs text-[#A9C1E8]">{formatHour(s.scheduledHour)}</p>
            </div>
            <div className="flex-1">
              <p className="text-[#EAF2FF] text-sm font-medium">{s.targetReps} reps</p>
              {s.completedReps !== null && (
                <p className="text-xs text-[#A9C1E8]">Done: {s.completedReps}</p>
              )}
            </div>
            <Badge status={s.status as any} />
            {isPending && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="w-14 text-sm bg-[#163A5F] text-[#EAF2FF] rounded px-2 py-1 border border-[#163A5F]"
                  value={repsInput}
                  onChange={e => setEditReps(r => ({ ...r, [s.id]: e.target.value }))}
                />
                <Button variant="complete" size="sm" onClick={() => onComplete(s.id, parseInt(repsInput) || s.targetReps)}>✓</Button>
                <Button variant="snooze"  size="sm" onClick={() => onSnooze(s.id)}>Z</Button>
                <Button variant="skip"    size="sm" onClick={() => onSkip(s.id)}>–</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

## src/components/dashboard/StatsPanel.tsx

```tsx
import type { DailyStats } from '@/types';

interface StatsPanelProps {
  todayStats: DailyStats;
  streak: number;
  weeklyCompliance: number;
  tomorrowReps: number;
  planStatus: string;
}

const PLAN_LABELS: Record<string, string> = {
  progressing: '📈 Progressing',
  holding: '⏸ Holding steady',
  deloading: '📉 Deload active',
};

export function StatsPanel({ todayStats, streak, weeklyCompliance, tomorrowReps, planStatus }: StatsPanelProps) {
  const tiles = [
    { label: 'Streak',    value: `${streak}d`,                        color: '#38BDF8' },
    { label: 'Today',     value: `${Math.round(todayStats.complianceRate * 100)}%`, color: '#22C55E' },
    { label: 'This week', value: `${Math.round(weeklyCompliance * 100)}%`,         color: '#22C55E' },
    { label: 'Completed', value: String(todayStats.completed),         color: '#22C55E' },
    { label: 'Missed',    value: String(todayStats.missed),            color: '#EF4444' },
    { label: 'Tomorrow',  value: `${tomorrowReps} reps`,              color: '#A9C1E8' },
  ];

  return (
    <div>
      <h2 className="text-[#EAF2FF] font-semibold text-sm uppercase tracking-wide mb-3">Stats</h2>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {tiles.map(t => (
          <div key={t.label} className="bg-[#112A46] border border-[#163A5F] rounded-lg p-3">
            <p className="text-xs text-[#A9C1E8] mb-1">{t.label}</p>
            <p className="text-xl font-bold" style={{ color: t.color }}>{t.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-[#112A46] border border-[#163A5F] rounded-lg p-3 text-sm text-[#A9C1E8]">
        Plan: <span className="text-[#EAF2FF] font-medium">{PLAN_LABELS[planStatus] ?? planStatus}</span>
      </div>
    </div>
  );
}
```

---

## src/components/dashboard/RepsChart.tsx

```tsx
'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { DailyStats } from '@/types';

interface RepsChartProps {
  stats: DailyStats[];
}

export function RepsChart({ stats }: RepsChartProps) {
  const data = [...stats]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(s => ({
      date: s.date.slice(5),  // MM-DD
      compliance: Math.round(s.complianceRate * 100),
    }));

  return (
    <div className="bg-[#112A46] border border-[#163A5F] rounded-lg p-4">
      <h2 className="text-[#EAF2FF] font-semibold text-sm uppercase tracking-wide mb-4">Compliance (30 days)</h2>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#163A5F" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#A9C1E8', fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fill: '#A9C1E8', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: '#112A46', border: '1px solid #163A5F', borderRadius: 6 }}
            labelStyle={{ color: '#EAF2FF' }}
            itemStyle={{ color: '#22C55E' }}
          />
          <Line type="monotone" dataKey="compliance" stroke="#22C55E" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## src/components/onboarding/OnboardingWizard.tsx

```tsx
import { useState } from 'react';
import type { AppSettings, ExperienceLevel } from '@/types';
import { Button } from '@/components/ui/Button';

const PRESETS: Record<ExperienceLevel, Partial<AppSettings['progression']>> = {
  beginner:     { startingReps: 5,  increaseAmount: 2, increaseEveryDays: 3, maxReps: 30 },
  intermediate: { startingReps: 10, increaseAmount: 3, increaseEveryDays: 3, maxReps: 50 },
  advanced:     { startingReps: 20, increaseAmount: 5, increaseEveryDays: 2, maxReps: 100 },
};

interface OnboardingWizardProps {
  onComplete: (settings: Partial<AppSettings>) => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<ExperienceLevel>('beginner');
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(21);
  const [maxReps, setMaxReps] = useState(30);

  const finish = () => {
    const preset = PRESETS[level];
    onComplete({
      experienceLevel: level,
      reminders: { startHour, endHour, enabled: true, snoozeMinutes: 10 },
      progression: { ...preset, maxReps } as AppSettings['progression'],
      startDate: new Date().toISOString().split('T')[0],
      onboardingComplete: true,
    });
  };

  return (
    <div className="min-h-screen bg-[#0B1C2D] flex items-center justify-center p-4">
      <div className="bg-[#112A46] border border-[#163A5F] rounded-xl p-8 w-full max-w-md">
        <h1 className="text-[#EAF2FF] text-2xl font-bold mb-1">PushUp Hourly</h1>
        <p className="text-[#A9C1E8] text-sm mb-8">Let's set up your training plan.</p>

        {step === 0 && (
          <div className="space-y-4">
            <label className="block text-[#A9C1E8] text-sm">Experience level</label>
            {(['beginner', 'intermediate', 'advanced'] as ExperienceLevel[]).map(l => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm capitalize transition-colors ${
                  level === l
                    ? 'border-[#38BDF8] bg-[#163A5F] text-[#EAF2FF]'
                    : 'border-[#163A5F] text-[#A9C1E8] hover:bg-[#163A5F]'
                }`}
              >
                {l} — start at {PRESETS[l].startingReps} reps
              </button>
            ))}
            <Button variant="secondary" className="w-full mt-4" onClick={() => setStep(1)}>Next →</Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-[#A9C1E8] text-sm mb-2">Reminder start hour</label>
              <input type="number" min={5} max={12} value={startHour}
                onChange={e => setStartHour(Number(e.target.value))}
                className="w-full bg-[#163A5F] text-[#EAF2FF] rounded px-3 py-2 border border-[#163A5F]" />
            </div>
            <div>
              <label className="block text-[#A9C1E8] text-sm mb-2">Reminder end hour</label>
              <input type="number" min={12} max={23} value={endHour}
                onChange={e => setEndHour(Number(e.target.value))}
                className="w-full bg-[#163A5F] text-[#EAF2FF] rounded px-3 py-2 border border-[#163A5F]" />
            </div>
            <div>
              <label className="block text-[#A9C1E8] text-sm mb-2">Goal (max reps)</label>
              <input type="number" min={10} max={200} value={maxReps}
                onChange={e => setMaxReps(Number(e.target.value))}
                className="w-full bg-[#163A5F] text-[#EAF2FF] rounded px-3 py-2 border border-[#163A5F]" />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
              <Button variant="secondary" className="flex-1" onClick={finish}>Start Training</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## src/components/settings/SettingsForm.tsx

```tsx
import type { AppSettings } from '@/types';
import { Button } from '@/components/ui/Button';
import { NotificationService } from '@/lib/notifications';
import { useState } from 'react';

interface SettingsFormProps {
  settings: AppSettings;
  onChange: (partial: Partial<AppSettings>) => void;
  onReset: () => void;
  onTestNotification: () => void;
}

export function SettingsForm({ settings, onChange, onReset, onTestNotification }: SettingsFormProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const { progression: p, reminders: r, deload: d } = settings;

  return (
    <div className="space-y-6 max-w-lg">
      {/* Reminders */}
      <section className="bg-[#112A46] border border-[#163A5F] rounded-lg p-5">
        <h3 className="text-[#EAF2FF] font-semibold mb-4">Reminders</h3>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-[#A9C1E8] text-sm">
            Start hour
            <input type="number" min={0} max={23} value={r.startHour}
              onChange={e => onChange({ reminders: { ...r, startHour: Number(e.target.value) } })}
              className="mt-1 w-full bg-[#163A5F] text-[#EAF2FF] rounded px-3 py-2 border border-[#163A5F]" />
          </label>
          <label className="block text-[#A9C1E8] text-sm">
            End hour
            <input type="number" min={0} max={23} value={r.endHour}
              onChange={e => onChange({ reminders: { ...r, endHour: Number(e.target.value) } })}
              className="mt-1 w-full bg-[#163A5F] text-[#EAF2FF] rounded px-3 py-2 border border-[#163A5F]" />
          </label>
          <label className="block text-[#A9C1E8] text-sm">
            Snooze (min)
            <input type="number" min={1} max={60} value={r.snoozeMinutes}
              onChange={e => onChange({ reminders: { ...r, snoozeMinutes: Number(e.target.value) } })}
              className="mt-1 w-full bg-[#163A5F] text-[#EAF2FF] rounded px-3 py-2 border border-[#163A5F]" />
          </label>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[#A9C1E8] text-sm cursor-pointer">
              <input type="checkbox" checked={r.enabled}
                onChange={e => onChange({ reminders: { ...r, enabled: e.target.checked } })} />
              Reminders on
            </label>
          </div>
        </div>
        <Button variant="secondary" size="sm" className="mt-4" onClick={onTestNotification}>
          Test Notification
        </Button>
      </section>

      {/* Progression */}
      <section className="bg-[#112A46] border border-[#163A5F] rounded-lg p-5">
        <h3 className="text-[#EAF2FF] font-semibold mb-4">Progression</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Starting reps',     key: 'startingReps',    min: 1,  max: 100  },
            { label: 'Increase amount',   key: 'increaseAmount',  min: 1,  max: 20   },
            { label: 'Increase every (days)', key: 'increaseEveryDays', min: 1, max: 30 },
            { label: 'Max reps',          key: 'maxReps',         min: 10, max: 200  },
          ].map(f => (
            <label key={f.key} className="block text-[#A9C1E8] text-sm">
              {f.label}
              <input type="number" min={f.min} max={f.max}
                value={(p as any)[f.key]}
                onChange={e => onChange({ progression: { ...p, [f.key]: Number(e.target.value) } })}
                className="mt-1 w-full bg-[#163A5F] text-[#EAF2FF] rounded px-3 py-2 border border-[#163A5F]" />
            </label>
          ))}
        </div>
      </section>

      {/* Deload */}
      <section className="bg-[#112A46] border border-[#163A5F] rounded-lg p-5">
        <h3 className="text-[#EAF2FF] font-semibold mb-4">Deload / Compliance</h3>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-[#A9C1E8] text-sm">
            Threshold (0–1)
            <input type="number" step={0.05} min={0.1} max={1} value={d.complianceThreshold}
              onChange={e => onChange({ deload: { ...d, complianceThreshold: Number(e.target.value) } })}
              className="mt-1 w-full bg-[#163A5F] text-[#EAF2FF] rounded px-3 py-2 border border-[#163A5F]" />
          </label>
          <label className="block text-[#A9C1E8] text-sm">
            Lookback days
            <input type="number" min={1} max={7} value={d.lookbackDays}
              onChange={e => onChange({ deload: { ...d, lookbackDays: Number(e.target.value) } })}
              className="mt-1 w-full bg-[#163A5F] text-[#EAF2FF] rounded px-3 py-2 border border-[#163A5F]" />
          </label>
          <label className="block text-[#A9C1E8] text-sm col-span-2">
            Behavior
            <select value={d.behavior}
              onChange={e => onChange({ deload: { ...d, behavior: e.target.value as any } })}
              className="mt-1 w-full bg-[#163A5F] text-[#EAF2FF] rounded px-3 py-2 border border-[#163A5F]">
              <option value="hold">Hold steady</option>
              <option value="reduce">Reduce reps</option>
            </select>
          </label>
        </div>
      </section>

      {/* Danger zone */}
      <section className="bg-[#112A46] border border-[#EF4444]/40 rounded-lg p-5">
        <h3 className="text-[#EF4444] font-semibold mb-2">Danger Zone</h3>
        {!confirmReset ? (
          <Button variant="destructive" size="sm" onClick={() => setConfirmReset(true)}>
            Reset All Progress
          </Button>
        ) : (
          <div className="flex gap-3 items-center">
            <p className="text-[#A9C1E8] text-sm">Are you sure? This cannot be undone.</p>
            <Button variant="destructive" size="sm" onClick={() => { onReset(); setConfirmReset(false); }}>Yes, Reset</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </div>
        )}
      </section>
    </div>
  );
}
```

---

## src/pages/_app.tsx

```tsx
import type { AppProps } from 'next/app';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
```

---

## src/pages/index.tsx  (Dashboard)

```tsx
import { useAppState } from '@/hooks/useAppState';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { TopBar } from '@/components/layout/TopBar';
import { SessionList } from '@/components/dashboard/SessionList';
import { StatsPanel } from '@/components/dashboard/StatsPanel';
import { RepsChart } from '@/components/dashboard/RepsChart';
import { getPlanStatusForDate } from '@/lib/compliance';
import { getRawTargetReps, getDayIndex } from '@/lib/progression';
import type { AppSettings } from '@/types';

export default function Dashboard() {
  const {
    settings, todaySessions, todayStats, allStats, streak,
    completeSession, skipSession, snoozeSession,
    updateSettings, resetProgress, testNotification, initialized,
  } = useAppState();

  if (!initialized) return null;

  if (!settings.onboardingComplete) {
    return (
      <OnboardingWizard
        onComplete={partial => updateSettings(partial as Partial<AppSettings>)}
      />
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

  const { reps: todayReps, status: planStatus } = getPlanStatusForDate(today, settings, allStats);
  const tomorrowIndex = getDayIndex(settings.startDate, tomorrow);
  const tomorrowReps = getRawTargetReps(tomorrowIndex, settings.progression);

  const last7 = allStats
    .filter(s => s.date >= new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]);
  const weeklyCompliance = last7.length
    ? last7.reduce((s, d) => s + d.complianceRate, 0) / last7.length
    : 0;

  return (
    <div className="min-h-screen bg-[#0B1C2D] text-[#EAF2FF] font-sans">
      <TopBar todayReps={todayReps} sessions={todaySessions} planStatus={planStatus} />

      <main className="pt-20 px-4 pb-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1: Session list */}
          <div className="lg:col-span-1">
            <SessionList
              sessions={todaySessions}
              onComplete={completeSession}
              onSkip={skipSession}
              onSnooze={snoozeSession}
            />
          </div>

          {/* Column 2: Charts */}
          <div className="lg:col-span-1 space-y-4">
            <RepsChart stats={allStats} />
          </div>

          {/* Column 3: Stats */}
          <div className="lg:col-span-1">
            <StatsPanel
              todayStats={todayStats}
              streak={streak}
              weeklyCompliance={weeklyCompliance}
              tomorrowReps={tomorrowReps}
              planStatus={planStatus}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

## src/pages/settings.tsx

```tsx
import { useAppState } from '@/hooks/useAppState';
import { TopBar } from '@/components/layout/TopBar';
import { SettingsForm } from '@/components/settings/SettingsForm';
import type { AppSettings } from '@/types';

export default function Settings() {
  const { settings, todaySessions, allStats, updateSettings, resetProgress, testNotification } = useAppState();
  const { reps, status } = require('@/lib/compliance').getPlanStatusForDate(
    new Date().toISOString().split('T')[0], settings, allStats
  );

  return (
    <div className="min-h-screen bg-[#0B1C2D] text-[#EAF2FF] font-sans">
      <TopBar todayReps={reps} sessions={todaySessions} planStatus={status} />
      <main className="pt-20 px-4 pb-8 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-6">Settings</h1>
        <SettingsForm
          settings={settings}
          onChange={partial => updateSettings(partial as Partial<AppSettings>)}
          onReset={resetProgress}
          onTestNotification={testNotification}
        />
      </main>
    </div>
  );
}
```

---

## src/styles/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  background-color: #0B1C2D;
  color: #EAF2FF;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

* {
  box-sizing: border-box;
}

input[type=number]::-webkit-inner-spin-button {
  opacity: 0.5;
}
```

---

## src/lib/cn.ts

```typescript
// Minimal classname utility (or use `clsx` + `tailwind-merge`)
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
```

---

## package.json

```json
{
  "name": "pushhour",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "export": "next build && next export"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18",
    "react-dom": "^18",
    "recharts": "^2.12.7",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/uuid": "^9",
    "autoprefixer": "^10.0.1",
    "eslint": "^8",
    "eslint-config-next": "14.2.3",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
```

---

## tailwind.config.ts

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg:        '#0B1C2D',
        surface:   '#112A46',
        panel:     '#163A5F',
        textPrim:  '#EAF2FF',
        textSec:   '#A9C1E8',
        complete:  '#22C55E',
        snooze:    '#FACC15',
        skip:      '#FB923C',
        danger:    '#EF4444',
        action:    '#38BDF8',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## next.config.ts

```typescript
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',   // Required for Capacitor — generates a static build
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
```

---

## capacitor.config.ts

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pushhour.app',
  appName: 'PushUp Hourly',
  webDir: 'out',    // Next.js static export target
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#38BDF8',
      sound: 'default',
    },
  },
};

export default config;
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

# Setup Instructions

## 1. Install & Run

```bash
# Clone or create the directory
mkdir pushhour && cd pushhour

# Copy all files from this document into their paths

# Install dependencies
npm install

# Run dev server
npm run dev
# → Open http://localhost:3000
```

## 2. Add Google Fonts (Inter)

In `src/pages/_app.tsx`, add:

```tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
// wrap <Component> with <main className={inter.className}>
```

---

# Capacitor + Android Setup (when ready to ship)

```bash
# Step 1: Install Capacitor core + CLI
npm install @capacitor/core @capacitor/cli

# Step 2: Initialize Capacitor (use values from capacitor.config.ts)
npx cap init "PushUp Hourly" "com.pushhour.app" --web-dir out

# Step 3: Install Android platform
npm install @capacitor/android
npx cap add android

# Step 4: Install local notifications plugin
npm install @capacitor/local-notifications
npx cap sync

# Step 5: Build web assets
npm run build   # generates /out via next export

# Step 6: Sync to Android
npx cap sync android

# Step 7: Open Android Studio
npx cap open android
```

## In Android Studio:

1. Wait for Gradle sync to complete
2. Update `android/app/src/main/AndroidManifest.xml` — add permissions:

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

3. Go to **Build → Generate Signed Bundle / APK**
4. Choose **Android App Bundle (.aab)**
5. Create or use an existing keystore
6. Build in **Release** mode
7. Upload the `.aab` file to Google Play Console

---

# Architecture Notes

## Progression Algorithm

```
targetReps = min(startingReps + floor(dayIndex / increaseEveryDays) * increaseAmount, maxReps)
```

Example with defaults (start=10, increase=2, every=3 days, max=50):
- Day 0–2:  10 reps
- Day 3–5:  12 reps
- Day 6–8:  14 reps
- Day 9–11: 16 reps
- ... and so on until 50

## Deload Logic

Every time the app loads, it checks: "What was the average compliance over the last N days?"

- If avgCompliance >= threshold → **progressing** (normal reps)
- If below threshold AND behavior = "hold" → **holding** (same reps, no increase)
- If below threshold AND behavior = "reduce" → **deloading** (reps × (1 - reducePercent))

## Storage

All data lives in `localStorage` under two keys:
- `puh_settings` — AppSettings JSON
- `puh_logs` — flat Record<id, SessionLog>

To upgrade to IndexedDB, swap the two functions in `src/lib/storage.ts`.

## Notification Limitations

| Feature | Browser | Capacitor (Android) |
|---|---|---|
| Fires when app is closed | ❌ | ✅ |
| Wakes device | ❌ | ✅ |
| Works in background | Partial | ✅ |
| Requires tab open | Yes | No |
| Reliable scheduling | No | Yes |

For production Android use, always use Capacitor's `@capacitor/local-notifications`. The browser fallback is dev-only.
```