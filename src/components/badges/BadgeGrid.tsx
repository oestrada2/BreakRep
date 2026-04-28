import { ALL_BADGES } from '@/lib/badges';
import type { EarnedBadge } from '@/types';

interface BadgeGridProps {
  earnedBadges: EarnedBadge[];
}

const CATEGORY_LABELS: Record<string, string> = {
  milestone:   'Milestones',
  streak:      'Streaks',
  volume:      'Volume',
  consistency: 'Consistency',
  social:      'Social',
};

export function BadgeGrid({ earnedBadges }: BadgeGridProps) {
  const earnedMap = new Map(earnedBadges.map(b => [b.id, b]));
  const totalEarned = earnedBadges.length;
  const total = ALL_BADGES.length;

  const categories = ['milestone', 'streak', 'volume', 'consistency', 'social'] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[var(--ct0)] text-sm font-bold">Badges</p>
          <p className="text-[var(--ct2)] text-xs mt-0.5">{totalEarned} of {total} earned</p>
        </div>
        {/* Progress bar */}
        <div className="w-24 h-2 bg-[var(--c4)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#FACC15] transition-all duration-700"
            style={{ width: `${Math.round((totalEarned / total) * 100)}%` }}
          />
        </div>
      </div>

      {categories.map(cat => {
        const badges = ALL_BADGES.filter(b => b.category === cat);
        return (
          <div key={cat}>
            <p className="text-[var(--ct2)] text-[10px] font-bold uppercase tracking-widest mb-2">
              {CATEGORY_LABELS[cat]}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {badges.map(def => {
                const earned = earnedMap.get(def.id);
                return (
                  <div
                    key={def.id}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all ${
                      earned
                        ? 'bg-[#1a1a0a] border-[#FACC15]/40'
                        : 'bg-[var(--c2)] border-[var(--c5)] opacity-40'
                    }`}
                    title={earned ? `${def.name} — earned ${earned.earnedAt}` : def.description}
                  >
                    <span className={`text-2xl ${earned ? '' : 'grayscale'}`} style={{ filter: earned ? 'none' : 'grayscale(1)' }}>
                      {def.emoji}
                    </span>
                    <p className={`text-[9px] font-semibold text-center leading-tight ${earned ? 'text-[#FACC15]' : 'text-[var(--ct2)]'}`}>
                      {def.name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
