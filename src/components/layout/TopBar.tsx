import { useCountdown } from '@/hooks/useCountdown';
import type { SessionLog } from '@/types';

interface TopBarProps {
  todayReps: number;
  sessions: SessionLog[];
  planStatus: string;
  completedCount: number;
  totalCount: number;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function TopBar({ sessions, planStatus, completedCount, totalCount }: TopBarProps) {
  const onTrack = planStatus === 'progressing';
  const behind  = completedCount === 0 && totalCount > 0;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--c0)]/95 backdrop-blur border-b border-[var(--c2)] px-4 py-3 flex items-center gap-3">
      {/* Logo mark */}
      <div className="w-8 h-8 rounded-lg bg-[#FACC15] flex items-center justify-center shrink-0 shadow-lg shadow-yellow-500/20">
        <span className="text-[#0B1C2D] text-sm font-black leading-none">B</span>
      </div>

      {/* Greeting + status */}
      <div className="flex-1 min-w-0">
        <p className="text-[var(--ct0)] text-sm font-semibold leading-tight truncate">{getGreeting()}</p>
        <p className="text-xs leading-tight">
          {completedCount < totalCount ? (
            <span className={behind ? 'text-[#EF4444]' : onTrack ? 'text-[#22C55E]' : 'text-[#FACC15]'}>
              {completedCount}/{totalCount} sessions · {behind ? 'Behind' : onTrack ? 'On Track' : 'Holding'}
            </span>
          ) : (
            <span className="text-[#22C55E]">All done today 🎉</span>
          )}
        </p>
      </div>

      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-[var(--c4)] border border-[var(--c5)] flex items-center justify-center text-sm shrink-0">
        🧑
      </div>
    </header>
  );
}
