export type SessionStatus = 'pending' | 'completed' | 'missed' | 'skipped' | 'snoozed';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type DeloadBehavior = 'hold' | 'reduce';

export interface ProgressionSettings {
  startingReps: number;
  increaseAmount: number;
  increaseEveryDays: number;
  maxReps: number;
}

export type AlertStyle = 'sound' | 'vibrate' | 'both';
export type ScheduleMode = 'auto' | 'custom';
export type NotificationSound = 'double-beep' | 'chime' | 'ping' | 'bell' | 'nudge';

export interface ReminderSettings {
  scheduleMode: ScheduleMode;
  // auto mode: hourly from start to end
  startHour: number;   // 0–23
  startMinute: number; // 0–59
  endHour: number;     // 0–23
  endMinute: number;   // 0–59
  // custom mode: which minute-marks within each hour to fire (multiples of 5, e.g. [15, 30])
  customMinutes: number[];
  enabled: boolean;
  snoozeMinutes: number;
  alertStyle: AlertStyle;
  notificationSound?: NotificationSound;
}

export interface DeloadSettings {
  complianceThreshold: number;   // default 0.6
  lookbackDays: number;          // default 2
  behavior: DeloadBehavior;
  reducePercent: number;         // default 0.15 (15%)
}

export interface EnabledExercises {
  pushups: boolean;
  squats: boolean;
  situps: boolean;
  [key: string]: boolean;        // custom exercises
}

export type TeamRole = 'admin' | 'member' | 'pending';

export interface TeamMember {
  id: string;
  displayName: string;
  username?: string;
  role: TeamRole;
  joinedAt: number; // unix ms timestamp
  avatar?: string;  // emoji
}

export interface Team {
  id: string;
  name: string;
  code: string;
  isAdmin: boolean;
  members: TeamMember[];
  joinedAt: number;
}

export interface AppSettings {
  progression: ProgressionSettings;
  reminders: ReminderSettings;
  deload: DeloadSettings;
  experienceLevel: ExperienceLevel;
  enabledExercises: EnabledExercises;
  customExerciseLabels?: Record<string, string>;           // key -> display label
  customExerciseTrackingTypes?: Record<string, 'reps' | 'time'>; // key -> tracking type
  teams?: Team[];
  /** @deprecated migrated to teams[] */
  teamName?: string;
  /** @deprecated migrated to teams[] */
  teamCode?: string;
  /** @deprecated migrated to teams[] */
  isTeamAdmin?: boolean;
  /** @deprecated migrated to teams[] */
  teamMembers?: TeamMember[];
  startDate: string;             // ISO date string YYYY-MM-DD
  onboardingComplete: boolean;
}

export interface SessionLog {
  id: string;                    // `${date}-${hour}` e.g. "2025-01-15-09"
  date: string;                  // YYYY-MM-DD
  scheduledHour: number;         // 0–23
  scheduledMinute: number;       // 0–59
  targetReps: number;
  completedReps: number | null;       // push-up reps
  completedSquatReps: number | null;  // squat reps
  completedSitupReps: number | null;  // sit-up reps (seconds)
  customExerciseReps?: Record<string, number | null>; // custom_* key -> reps or seconds
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
  totalReps: number;
  pushupReps: number;
  squatReps: number;
  situpReps: number;             // seconds
  customExerciseStats?: Record<string, number>; // custom_* key -> total reps or seconds
}

export interface AppState {
  settings: AppSettings;
  logs: Record<string, SessionLog>;   // keyed by SessionLog.id
  initialized: boolean;
}
