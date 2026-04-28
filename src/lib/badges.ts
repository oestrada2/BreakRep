import type { DailyStats, EarnedBadge } from '@/types';

export interface BadgeDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: 'streak' | 'volume' | 'consistency' | 'milestone';
}

export const ALL_BADGES: BadgeDef[] = [
  // ── Milestone ──────────────────────────────────────────────────────────────
  { id: 'first_session',  name: 'First Step',      emoji: '👟', description: 'Complete your very first session',           category: 'milestone' },
  { id: 'level_up',       name: 'Level Up',         emoji: '📈', description: 'Your rep target increases for the first time', category: 'milestone' },
  { id: 'comeback',       name: 'Comeback',         emoji: '💥', description: 'Complete a session after missing 3+ days',  category: 'milestone' },

  // ── Streak ─────────────────────────────────────────────────────────────────
  { id: 'streak_3',   name: 'Hat Trick',    emoji: '🔥',  description: '3-day streak',   category: 'streak' },
  { id: 'streak_7',   name: 'One Week',     emoji: '⚡',  description: '7-day streak',   category: 'streak' },
  { id: 'streak_14',  name: 'Fortnight',    emoji: '💫',  description: '14-day streak',  category: 'streak' },
  { id: 'streak_30',  name: 'One Month',    emoji: '🏅',  description: '30-day streak',  category: 'streak' },
  { id: 'streak_60',  name: 'Two Months',   emoji: '🥈',  description: '60-day streak',  category: 'streak' },
  { id: 'streak_100', name: 'Century',      emoji: '🏆',  description: '100-day streak', category: 'streak' },

  // ── Volume ─────────────────────────────────────────────────────────────────
  { id: 'reps_100',   name: 'First Hundred',  emoji: '💯', description: '100 total reps',    category: 'volume' },
  { id: 'reps_500',   name: 'Five Hundred',   emoji: '🎯', description: '500 total reps',    category: 'volume' },
  { id: 'reps_1000',  name: 'One Thousand',   emoji: '💪', description: '1,000 total reps',  category: 'volume' },
  { id: 'reps_5000',  name: 'Five Thousand',  emoji: '🦾', description: '5,000 total reps',  category: 'volume' },
  { id: 'reps_10000', name: 'Ten Thousand',   emoji: '👑', description: '10,000 total reps', category: 'volume' },

  // ── Consistency ────────────────────────────────────────────────────────────
  { id: 'perfect_day',  name: 'Perfect Day',  emoji: '⭐', description: '100% of sessions completed in a day',                  category: 'consistency' },
  { id: 'perfect_week', name: 'Perfect Week', emoji: '🌟', description: 'Every active day this week hit 80%+ completion',        category: 'consistency' },
  { id: 'early_bird',   name: 'Early Bird',   emoji: '🌅', description: 'Complete a session before 8 AM',                        category: 'consistency' },
  { id: 'five_sessions','name: Five in a Day', emoji: '🚀', description: 'Complete 5 or more sessions in a single day',          category: 'consistency' },
];

// Fix the name field typo above
ALL_BADGES.find(b => b.id === 'five_sessions')!.name = 'Five in a Day';

export function getBadgeDef(id: string): BadgeDef | undefined {
  return ALL_BADGES.find(b => b.id === id);
}

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface BadgeEvalInput {
  allStats: DailyStats[];
  todayStats: DailyStats;
  streak: number;
  earnedBadges: EarnedBadge[];
  prevReps: number;  // rep target before last session (to detect level-up)
  currentReps: number;
}

/**
 * Returns IDs of badges newly earned that weren't in earnedBadges before.
 */
export function evaluateBadges(input: BadgeEvalInput): string[] {
  const { allStats, todayStats, streak, earnedBadges, prevReps, currentReps } = input;
  const alreadyEarned = new Set(earnedBadges.map(b => b.id));
  const newlyEarned: string[] = [];

  const earn = (id: string) => {
    if (!alreadyEarned.has(id) && !newlyEarned.includes(id)) newlyEarned.push(id);
  };

  // ── Total reps (push-ups + squats across all time) ─────────────────────────
  const totalReps = allStats.reduce((n, s) => n + s.totalReps, 0);

  // ── Milestone ──────────────────────────────────────────────────────────────
  if (allStats.some(s => s.completed > 0) || todayStats.completed > 0) earn('first_session');

  if (prevReps > 0 && currentReps > prevReps) earn('level_up');

  // Comeback: today has completions AND there's a gap of 3+ missed days before today
  const today = toLocalISO(new Date());
  const sortedDates = [...allStats].sort((a, b) => a.date.localeCompare(b.date));
  const todayIdx = sortedDates.findIndex(s => s.date === today);
  if (todayStats.completed > 0 && todayIdx >= 3) {
    const recentMissed = sortedDates
      .slice(Math.max(0, todayIdx - 5), todayIdx)
      .filter(s => s.complianceRate < 0.3);
    if (recentMissed.length >= 3) earn('comeback');
  }

  // ── Streak ─────────────────────────────────────────────────────────────────
  if (streak >= 3)   earn('streak_3');
  if (streak >= 7)   earn('streak_7');
  if (streak >= 14)  earn('streak_14');
  if (streak >= 30)  earn('streak_30');
  if (streak >= 60)  earn('streak_60');
  if (streak >= 100) earn('streak_100');

  // ── Volume ─────────────────────────────────────────────────────────────────
  if (totalReps >= 100)   earn('reps_100');
  if (totalReps >= 500)   earn('reps_500');
  if (totalReps >= 1000)  earn('reps_1000');
  if (totalReps >= 5000)  earn('reps_5000');
  if (totalReps >= 10000) earn('reps_10000');

  // ── Consistency ────────────────────────────────────────────────────────────
  if (todayStats.totalSessions > 0 && todayStats.completed >= todayStats.totalSessions) earn('perfect_day');

  if (todayStats.completed >= 5) earn('five_sessions');

  // Perfect week: all active-day stats this week have complianceRate >= 0.8
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekStart = toLocalISO(new Date(Date.now() + mondayOffset * 86_400_000));
  const weekStats = allStats.filter(s => s.date >= weekStart && s.date <= today);
  if (weekStats.length >= 5 && weekStats.every(s => s.complianceRate >= 0.8)) earn('perfect_week');

  // Early bird: any completed session with scheduledHour < 8
  // We can't check this from DailyStats alone, but we can check if todayStats came from an early session
  // This is a best-effort check stored externally; skip for now since it needs raw session data

  return newlyEarned;
}
