import { useState } from 'react';
import type { DailyStats } from '@/types';

interface WeekStripProps {
  selectedDate: string;
  statsMap: Record<string, DailyStats>;
  onSelect: (date: string) => void;
}

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number) {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

// Start of the week (Sunday) for a given date
function startOfWeek(d: Date) {
  const result = new Date(d);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

export function WeekStrip({ selectedDate, statsMap, onSelect }: WeekStripProps) {
  const today = toLocalISO(new Date());

  // weekOffset: 0 = current week, -1 = last week, etc.
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = addDays(startOfWeek(new Date()), weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return {
      iso:   toLocalISO(d),
      label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
      num:   d.getDate(),
      month: d.getMonth(),
    };
  });

  // Month label — show range if week spans two months
  const firstMonth = weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const lastDay    = addDays(weekStart, 6);
  const lastMonth  = lastDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthLabel = firstMonth === lastMonth
    ? firstMonth
    : `${weekStart.toLocaleDateString('en-US', { month: 'short' })} – ${lastDay.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="space-y-2">
      {/* Month label + nav */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="w-7 h-7 rounded-lg bg-[var(--c4)] border border-[var(--c5)] flex items-center justify-center text-[var(--ct1)] hover:text-[var(--ct0)] hover:border-[var(--ca)]/40 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <span className="text-[var(--ct1)] text-xs font-semibold">{monthLabel}</span>

        <button
          onClick={() => setWeekOffset(o => o + 1)}
          disabled={isCurrentWeek}
          className="w-7 h-7 rounded-lg bg-[var(--c4)] border border-[var(--c5)] flex items-center justify-center text-[var(--ct1)] hover:text-[var(--ct0)] hover:border-[var(--ca)]/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* Day buttons */}
      <div className="flex gap-1.5">
        {days.map(day => {
          const isSelected = day.iso === selectedDate;
          const isToday    = day.iso === today;
          const isFuture   = day.iso > today;
          const stats      = statsMap[day.iso];
          const rate       = stats?.complianceRate ?? 0;
          const hasData    = !!stats && stats.totalSessions > 0;

          const noActivity = !hasData || stats.completed === 0;
          const ringColor = noActivity || isFuture ? null
            : rate >= 0.6 ? '#22C55E'
            : rate >= 0.3 ? '#FACC15'
            : '#EF4444';

          const glowStyle = !noActivity && !isFuture && rate >= 0.6
            ? { boxShadow: `0 0 0 2px #22C55E, 0 0 14px 4px rgba(34,197,94,0.5)` }
            : ringColor
            ? { boxShadow: `0 0 0 2px ${ringColor}` }
            : {};

          return (
            <button
              key={day.iso}
              onClick={() => !isFuture && onSelect(day.iso)}
              disabled={isFuture}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition-all border ${
                isSelected
                  ? 'border-[#F97316] bg-[#F97316]'
                  : isToday
                  ? 'border-transparent bg-[var(--c3)]'
                  : isFuture
                  ? 'border-transparent bg-[var(--c2)] opacity-30'
                  : 'border-transparent bg-[var(--c2)] hover:bg-[var(--c4)]'
              }`}
              style={!isSelected ? glowStyle : {}}
            >
              <span className={`text-xs font-medium ${isSelected ? 'text-[#09090B]' : 'text-[var(--ct2)]'}`}>
                {day.label}
              </span>
              <span className={`text-sm font-bold ${
                isSelected  ? 'text-[#09090B]'
                : isToday   ? 'text-[var(--ca)]'
                : ringColor ? 'text-[var(--ct0)]'
                : 'text-[var(--ct2)]'
              }`}>
                {day.num}
              </span>
              {hasData && !isSelected && !isFuture && (
                <span className="text-[9px] leading-none font-semibold" style={{ color: ringColor ?? 'var(--ct2)' }}>
                  {Math.round(rate * 100)}%
                </span>
              )}
              {isToday && !hasData && (
                <div className="w-1 h-1 rounded-full bg-[var(--ca)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
