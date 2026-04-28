import type { DailyStats, EarnedBadge, AppSettings } from '@/types';

export interface BadgeDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: 'streak' | 'volume' | 'consistency' | 'milestone' | 'social';
}

export const ALL_BADGES: BadgeDef[] = [
  // ── Milestone ──────────────────────────────────────────────────────────────
  { id: 'first_session', name: 'First Step',    emoji: '👟', description: 'Complete your very first session',              category: 'milestone' },
  { id: 'level_up',      name: 'Level Up',      emoji: '📈', description: 'Your rep target increases for the first time',  category: 'milestone' },

  // ── Streak ─────────────────────────────────────────────────────────────────
  { id: 'streak_3',   name: 'Hat Trick',    emoji: '🔥', description: '3-day streak',    category: 'streak' },
  { id: 'streak_7',   name: 'One Week',     emoji: '⚡', description: '7-day streak',    category: 'streak' },
  { id: 'streak_14',  name: 'Fortnight',   emoji: '💫', description: '14-day streak',   category: 'streak' },
  { id: 'streak_21',  name: 'Three Weeks', emoji: '🌙', description: '21-day streak',   category: 'streak' },
  { id: 'streak_30',  name: 'One Month',   emoji: '🏅', description: '30-day streak',   category: 'streak' },
  { id: 'streak_45',  name: '45 Days',     emoji: '🔑', description: '45-day streak',   category: 'streak' },
  { id: 'streak_60',  name: 'Two Months',  emoji: '🥈', description: '60-day streak',   category: 'streak' },
  { id: 'streak_100', name: 'Century',     emoji: '🏆', description: '100-day streak',  category: 'streak' },

  // ── Volume ─────────────────────────────────────────────────────────────────
  { id: 'reps_100',      name: 'First Hundred',  emoji: '💯', description: '100 total reps completed',       category: 'volume' },
  { id: 'reps_500',      name: 'Five Hundred',   emoji: '🎯', description: '500 total reps completed',       category: 'volume' },
  { id: 'reps_1000',     name: 'One Thousand',   emoji: '💪', description: '1,000 total reps completed',     category: 'volume' },
  { id: 'reps_5000',     name: 'Five Thousand',  emoji: '🦾', description: '5,000 total reps completed',     category: 'volume' },
  { id: 'reps_10000',    name: 'Ten Thousand',   emoji: '👑', description: '10,000 total reps completed',    category: 'volume' },
  { id: 'pushup_king',   name: 'Push-up King',   emoji: '💪', description: '1,000 push-up reps completed',  category: 'volume' },
  { id: 'squat_legend',  name: 'Squat Legend',   emoji: '🦵', description: '1,000 squat reps completed',    category: 'volume' },

  // ── Consistency ────────────────────────────────────────────────────────────
  { id: 'perfect_day',      name: 'Perfect Day',       emoji: '⭐', description: '100% of sessions completed in a day',               category: 'consistency' },
  { id: 'perfect_week',     name: 'Perfect Week',      emoji: '🌟', description: 'Every active day this week hit 80%+ completion',     category: 'consistency' },
  { id: 'overachiever',     name: 'Overachiever',      emoji: '🚀', description: '90%+ session completion rate for a full week',       category: 'consistency' },
  { id: 'early_bird',       name: 'Early Bird',        emoji: '🌅', description: 'Complete a session before 8 AM',                    category: 'consistency' },
  { id: 'night_owl',        name: 'Night Owl',         emoji: '🦉', description: 'Complete a session after 8 PM',                     category: 'consistency' },
  { id: 'creature_of_habit',name: 'Creature of Habit', emoji: '📅', description: '4 perfect weeks in a row',                          category: 'consistency' },
  { id: 'work_mode',        name: 'Work Mode',         emoji: '💼', description: 'Complete every Monday session for 4 weeks in a row', category: 'consistency' },

  // ── Social ─────────────────────────────────────────────────────────────────
  { id: 'team_player',  name: 'Team Player',  emoji: '🤝', description: 'Join a team',                           category: 'social' },
  { id: 'pack_leader',  name: 'Pack Leader',  emoji: '🦁', description: 'Finish #1 on your team leaderboard for a week', category: 'social' },
];

export function getBadgeDef(id: string): BadgeDef | undefined {
  return ALL_BADGES.find(b => b.id === id);
}

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns Monday (local) of the ISO week containing `dateStr`. */
function weekStart(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  const dow = dt.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(y, mo - 1, d + offset);
  return toLocalISO(monday);
}

export interface BadgeEvalInput {
  allStats: DailyStats[];
  todayStats: DailyStats;
  streak: number;
  earnedBadges: EarnedBadge[];
  prevReps: number;
  currentReps: number;
  /** scheduledHour of the session that was just completed (for Early Bird / Night Owl) */
  completedSessionHour?: number;
  /** Full app settings (for Team Player check) */
  settings?: AppSettings;
}

/**
 * Returns IDs of badges newly earned that weren't in earnedBadges before.
 */
export function evaluateBadges(input: BadgeEvalInput): string[] {
  const {
    allStats, todayStats, streak, earnedBadges,
    prevReps, currentReps,
    completedSessionHour,
    settings,
  } = input;

  const alreadyEarned = new Set(earnedBadges.map(b => b.id));
  const newlyEarned: string[] = [];

  const earn = (id: string) => {
    if (!alreadyEarned.has(id) && !newlyEarned.includes(id)) newlyEarned.push(id);
  };

  const today = toLocalISO(new Date());
  const totalReps    = allStats.reduce((n, s) => n + s.totalReps, 0);
  const totalPushups = allStats.reduce((n, s) => n + s.pushupReps, 0);
  const totalSquats  = allStats.reduce((n, s) => n + s.squatReps, 0);

  // ── Milestone ──────────────────────────────────────────────────────────────
  if (allStats.some(s => s.completed > 0) || todayStats.completed > 0) earn('first_session');

  if (prevReps > 0 && currentReps > prevReps) earn('level_up');


  // ── Streak ─────────────────────────────────────────────────────────────────
  if (streak >= 3)   earn('streak_3');
  if (streak >= 7)   earn('streak_7');
  if (streak >= 14)  earn('streak_14');
  if (streak >= 21)  earn('streak_21');
  if (streak >= 30)  earn('streak_30');
  if (streak >= 45)  earn('streak_45');
  if (streak >= 60)  earn('streak_60');
  if (streak >= 100) earn('streak_100');

  // ── Volume ─────────────────────────────────────────────────────────────────
  if (totalReps >= 100)   earn('reps_100');
  if (totalReps >= 500)   earn('reps_500');
  if (totalReps >= 1000)  earn('reps_1000');
  if (totalReps >= 5000)  earn('reps_5000');
  if (totalReps >= 10000) earn('reps_10000');
  if (totalPushups >= 1000) earn('pushup_king');
  if (totalSquats  >= 1000) earn('squat_legend');

  // ── Consistency ────────────────────────────────────────────────────────────
  if (todayStats.totalSessions > 0 && todayStats.completed >= todayStats.totalSessions) earn('perfect_day');

  // Early Bird / Night Owl — triggered by scheduled hour of the session just completed
  if (completedSessionHour !== undefined) {
    if (completedSessionHour < 8)  earn('early_bird');
    if (completedSessionHour >= 20) earn('night_owl');
  }

  // Perfect week: current week (Mon–today), at least 5 days, all ≥ 80%
  const thisWeekStart = weekStart(today);
  const weekStats = allStats.filter(s => s.date >= thisWeekStart && s.date <= today);
  if (weekStats.length >= 5 && weekStats.every(s => s.complianceRate >= 0.8)) earn('perfect_week');

  // Overachiever: any completed week (not the current one) with ≥ 90% compliance
  // Group allStats by week, skip the current week, check total sessions vs completed
  {
    const byWeek: Record<string, DailyStats[]> = {};
    for (const s of allStats) {
      const ws = weekStart(s.date);
      if (ws === thisWeekStart) continue; // skip current week
      (byWeek[ws] ??= []).push(s);
    }
    for (const days of Object.values(byWeek)) {
      const totalSess = days.reduce((n, d) => n + d.totalSessions, 0);
      const doneSess  = days.reduce((n, d) => n + d.completed, 0);
      if (totalSess >= 5 && doneSess / totalSess >= 0.9) { earn('overachiever'); break; }
    }
  }

  // Creature of Habit: 4 consecutive perfect weeks (all days in week ≥ 80% compliance)
  {
    const byWeek: Record<string, DailyStats[]> = {};
    for (const s of allStats) {
      const ws = weekStart(s.date);
      (byWeek[ws] ??= []).push(s);
    }
    const sortedWeeks = Object.keys(byWeek).sort();
    let streak4 = 0;
    for (const ws of sortedWeeks) {
      const days = byWeek[ws];
      const isPerfect = days.length >= 1 && days.every(d => d.complianceRate >= 0.8);
      streak4 = isPerfect ? streak4 + 1 : 0;
      if (streak4 >= 4) { earn('creature_of_habit'); break; }
    }
  }

  // Work Mode: 4 consecutive Mondays with at least one session completed
  {
    const mondays = allStats
      .filter(s => {
        const [y, mo, d] = s.date.split('-').map(Number);
        return new Date(y, mo - 1, d).getDay() === 1 && s.completed > 0;
      })
      .map(s => s.date)
      .sort();

    let consec = 1;
    for (let i = 1; i < mondays.length; i++) {
      const prev = new Date(mondays[i - 1] + 'T12:00:00');
      const curr = new Date(mondays[i]     + 'T12:00:00');
      const daysDiff = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
      consec = daysDiff === 7 ? consec + 1 : 1;
      if (consec >= 4) { earn('work_mode'); break; }
    }
  }

  // ── Social ─────────────────────────────────────────────────────────────────
  if (settings?.teams && settings.teams.length > 0) earn('team_player');
  // pack_leader requires server-side leaderboard data — evaluated separately

  return newlyEarned;
}
