import { useState } from 'react';
import type { DailyStats } from '@/types';

interface CalendarViewProps {
  statsMap: Record<string, DailyStats>;
  selectedDate: string;
  onSelect: (date: string) => void;
}

function toLocalISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dayStyle(stats: DailyStats | undefined): { ring: string; glow: string; text: string; bg: string } {
  if (!stats || stats.totalSessions === 0 || stats.completed === 0) return { ring: '', glow: '', text: 'var(--ct2)', bg: 'var(--c4)' };
  const r = stats.complianceRate;
  if (r >= 0.6) return { ring: '#22C55E', glow: '0 0 14px 5px rgba(34,197,94,0.35)', text: '#fff', bg: '#22C55E' };
  if (r >= 0.3) return { ring: '#FACC15', glow: '0 0 0 2px #FACC15, 0 0 10px 3px rgba(250,204,21,0.4)',  text: '#FACC15', bg: 'transparent' };
  return               { ring: '#EF4444', glow: '0 0 0 2px #EF4444, 0 0 10px 3px rgba(239,68,68,0.4)',   text: '#EF4444', bg: 'transparent' };
}

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarView({ statsMap, selectedDate, onSelect }: CalendarViewProps) {
  const todayDate = new Date();
  const todayISO  = toLocalISO(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());

  const [cursor, setCursor] = useState(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    return { year: y, month: m - 1 }; // 0-indexed month
  });

  const { year, month } = cursor;
  const firstDow  = new Date(year, month, 1).getDay();      // 0=Sun
  const daysInMon = new Date(year, month + 1, 0).getDate();
  const prevDays  = new Date(year, month, 0).getDate();

  // Cells: prev-month padding + current month + next-month padding
  const cells: { iso: string | null; day: number; inMonth: boolean }[] = [];

  for (let i = 0; i < firstDow; i++) {
    cells.push({ iso: null, day: prevDays - firstDow + 1 + i, inMonth: false });
  }
  for (let d = 1; d <= daysInMon; d++) {
    cells.push({ iso: toLocalISO(year, month, d), day: d, inMonth: true });
  }
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    cells.push({ iso: null, day: d, inMonth: false });
  }

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 });
  const nextMonth = () => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 });

  const legend = [
    { color: '#22C55E', label: '≥60%',  fill: true },
    { color: '#FACC15', label: '30–59%', fill: false },
    { color: '#EF4444', label: '<30%',   fill: false },
  ];

  return (
    <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-4 space-y-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="w-8 h-8 rounded-lg bg-[var(--c4)] border border-[var(--c5)] flex items-center justify-center text-[var(--ct1)] hover:text-[var(--ct0)] hover:border-[var(--ca)]/40 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <p className="text-[var(--ct0)] text-sm font-semibold">{monthLabel}</p>
        <button
          onClick={nextMonth}
          disabled={`${year}-${String(month + 1).padStart(2, '0')}` >= `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`}
          className="w-8 h-8 rounded-lg bg-[var(--c4)] border border-[var(--c5)] flex items-center justify-center text-[var(--ct1)] hover:text-[var(--ct0)] hover:border-[var(--ca)]/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className="text-center text-[var(--ct2)] text-xs font-semibold py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell.inMonth || !cell.iso) {
            return <div key={i} className="aspect-square flex items-center justify-center text-[var(--c6)] text-xs">{cell.day}</div>;
          }

          const stats    = statsMap[cell.iso];
          const s        = dayStyle(stats);
          const isSel    = cell.iso === selectedDate;
          const isToday  = cell.iso === todayISO;
          const isFuture = cell.iso > todayISO;

          return (
            <button
              key={i}
              onClick={() => !isFuture && onSelect(cell.iso!)}
              disabled={isFuture}
              className={`aspect-square flex flex-col items-center justify-center rounded-full text-xs font-bold transition-all relative
                ${isFuture ? 'opacity-25 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
              `}
              style={{
                background: stats && !isFuture ? s.bg : (isSel ? 'var(--c4)' : 'var(--c4)'),
                color:      stats && !isFuture ? s.text : (isToday || isSel ? 'var(--ct0)' : 'var(--ct2)'),
                boxShadow:  stats && !isFuture
                  ? (isSel ? s.glow + ', 0 0 0 3px rgba(255,255,255,0.6)' : s.glow)
                  : isSel
                    ? '0 0 0 2px rgba(255,255,255,0.7), 0 0 10px 3px rgba(255,255,255,0.15)'
                    : undefined,
              }}
            >
              <span>{cell.day}</span>
              {stats && stats.totalReps > 0 && !isFuture && (
                <span className="text-[8px] font-semibold leading-none mt-0.5" style={{ color: s.bg === '#22C55E' ? 'rgba(255,255,255,0.8)' : (s.ring || 'var(--ct2)') }}>
                  {Math.round((stats.complianceRate) * 100)}%
                </span>
              )}
              {isToday && !stats && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--ca)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="pt-1 space-y-1.5">
        <span className="text-[var(--ct2)] text-xs block text-center">Completion rate</span>
        <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1.5">
          {legend.map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={l.fill
                  ? { background: l.color }
                  : { background: 'transparent', border: `1.5px solid ${l.color}` }
                }
              />
              <span className="text-[var(--ct2)] text-xs">{l.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-[var(--c4)]" />
            <span className="text-[var(--ct2)] text-xs">No data</span>
          </div>
        </div>
      </div>
    </div>
  );
}
