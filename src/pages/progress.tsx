import { useAppState } from '@/hooks/useAppState';
import { NavTabs } from '@/components/layout/NavTabs';
import { StatsPanel } from '@/components/dashboard/StatsPanel';
import { RepsChart } from '@/components/dashboard/RepsChart';
import { TeamPreview } from '@/components/dashboard/TeamPreview';
import { getPlanStatusForDate } from '@/lib/compliance';
import { getRawTargetReps, getDayIndex } from '@/lib/progression';
import Link from 'next/link';

export default function Progress() {
  const { settings, todayStats, allStats, streak, initialized } = useAppState();

  if (!initialized) return null;

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

  const { status: planStatus } = getPlanStatusForDate(today, settings, allStats);
  const tomorrowIndex = getDayIndex(settings.startDate, tomorrow);
  const tomorrowReps = getRawTargetReps(tomorrowIndex, settings.progression);

  const last7 = allStats.filter(
    s => s.date >= new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
  );
  const weeklyCompliance = last7.length
    ? last7.reduce((s, d) => s + d.complianceRate, 0) / last7.length
    : 0;

  return (
    <div className="min-h-screen bg-[var(--c0)] text-[var(--ct0)] font-sans pb-20">
      <header className="sticky top-0 z-50 bg-[var(--c0)]/95 backdrop-blur border-b border-[var(--c2)] px-4 pt-4 pb-3">
        <h1 className="text-[var(--ct0)] text-xl font-bold">Progress</h1>
        <p className="text-[var(--ct2)] text-xs mt-0.5">Your stats, trends, and team</p>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Stats */}
        <StatsPanel
          todayStats={todayStats}
          streak={streak}
          weeklyCompliance={weeklyCompliance}
          tomorrowReps={tomorrowReps}
          planStatus={planStatus}
          allStats={allStats}
        />

        {/* Weekly chart */}
        <RepsChart stats={allStats} />

        {/* Team */}
        <TeamPreview />

        {/* Quick actions */}
        <div>
          <p className="text-[var(--ct0)] text-sm font-semibold mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'View History',     icon: '📋', href: '/logs' },
              { label: 'Adjust Schedule',  icon: '⏰', href: '/settings' },
              { label: 'Team Leaderboard', icon: '🏆', href: '/logs' },
              { label: 'Settings',         icon: '⚙️', href: '/settings' },
            ].map(a => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center gap-3 bg-[var(--c2)] border border-[var(--c5)] rounded-2xl px-4 py-3 text-sm text-[var(--ct1)] hover:border-[var(--ca)]/50 hover:text-[var(--ct0)] transition-colors"
              >
                <span className="text-base">{a.icon}</span>
                {a.label}
              </Link>
            ))}
          </div>
        </div>

      </main>

      <NavTabs />
    </div>
  );
}
