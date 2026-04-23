import { useState, useMemo } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { NavTabs } from '@/components/layout/NavTabs';
import { HistoryInsights } from '@/components/history/HistoryInsights';
import { WeekStrip } from '@/components/history/WeekStrip';
import { DayCard } from '@/components/history/DayCard';
import { CalendarView } from '@/components/history/CalendarView';
import { computeDayStats } from '@/lib/compliance';
import type { SessionLog } from '@/types';

type FilterStatus = 'all' | 'completed' | 'missed' | 'skipped' | 'snoozed';

const FILTERS: { value: FilterStatus; label: string; color: string }[] = [
  { value: 'all',       label: 'All',      color: 'var(--ct1)' },
  { value: 'completed', label: 'Done',     color: '#22C55E' },
  { value: 'missed',    label: 'Missed',   color: '#EF4444' },
  { value: 'skipped',   label: 'Skipped',  color: '#FB923C' },
  { value: 'snoozed',   label: 'Snoozed',  color: '#FACC15' },
];

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Logs() {
  const { logs, allStats, streak, todaySessions, settings } = useAppState();

  const todayISO = toLocalISO(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'day' | 'calendar' | 'all'>('day');

  // Group all logs by date, merging today's generated sessions so the day
  // view always shows pending sessions even before they're persisted to logs.
  const byDate = useMemo(() => {
    const map: Record<string, SessionLog[]> = {};
    Object.values(logs).forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    // Overlay today's resolved sessions (includes pending ones not yet in logs)
    if (todaySessions.length > 0) {
      const d = todaySessions[0].date;
      const existingIds = new Set((map[d] ?? []).map(s => s.id));
      const additions = todaySessions.filter(s => !existingIds.has(s.id));
      map[d] = [...(map[d] ?? []), ...additions];
    }
    // Sort sessions within each day by scheduled time
    Object.values(map).forEach(arr => arr.sort((a, b) =>
      a.scheduledHour !== b.scheduledHour
        ? a.scheduledHour - b.scheduledHour
        : (a.scheduledMinute ?? 0) - (b.scheduledMinute ?? 0)
    ));
    return map;
  }, [logs, todaySessions]);

  const activeDates = useMemo(() => new Set(Object.keys(byDate)), [byDate]);

  // Stats lookup by date
  const statsMap = useMemo(() => {
    const m: Record<string, ReturnType<typeof computeDayStats>> = {};
    allStats.forEach(s => { m[s.date] = s; });
    return m;
  }, [allStats]);

  // Period summary (last 7 days)
  const periodStats = useMemo(() => {
    const cutoff = toLocalISO(new Date(Date.now() - 6 * 86_400_000));
    const relevant = allStats.filter(s => s.date >= cutoff);
    return {
      completed:  relevant.reduce((n, s) => n + s.completed, 0),
      missed:     relevant.reduce((n, s) => n + s.missed, 0),
      totalReps:  relevant.reduce((n, s) => n + s.totalReps, 0),
      rate:       relevant.length
        ? Math.round(relevant.reduce((n, s) => n + s.complianceRate, 0) / relevant.length * 100)
        : 0,
    };
  }, [allStats]);

  // Days to render in 'all' view (sorted newest first, filtered by search)
  const allDates = useMemo(() => {
    return Object.keys(byDate)
      .filter(d => !search || d.includes(search))
      .sort((a, b) => b.localeCompare(a));
  }, [byDate, search]);

  return (
    <div className="min-h-screen bg-[var(--c0)] text-[var(--ct0)] font-sans pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--c0)]/95 backdrop-blur border-b border-[var(--c2)] px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--ct0)] text-xl font-bold">History</h1>
            <p className="text-[var(--ct2)] text-xs mt-0.5">Review your sessions and track consistency</p>
          </div>
          {/* View toggle */}
          <div className="flex bg-[var(--c2)] border border-[var(--c5)] rounded-xl p-0.5 gap-0.5">
            {([['day','Day'], ['calendar','Cal'], ['all','All']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  view === v ? 'bg-[#FACC15] text-[#0B1C2D]' : 'text-[var(--ct2)] hover:text-[var(--ct1)]'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Week strip (day view only) */}
        {(view === 'day') && (
          <WeekStrip
            selectedDate={selectedDate}
            statsMap={statsMap}
            onSelect={setSelectedDate}
          />
        )}

        {/* Search (all view only) */}
        {view === 'all' && (
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ct2)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Search by date…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--c2)] border border-[var(--c5)] rounded-xl pl-8 pr-3 py-2 text-sm text-[var(--ct0)] placeholder-[var(--ct2)] focus:border-[#FACC15]/50 outline-none transition-colors"
            />
          </div>
        )}

        {/* Status filters */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                filter === f.value
                  ? 'border-transparent text-[#0B1C2D]'
                  : 'bg-transparent border-[var(--c5)] text-[var(--ct2)] hover:text-[var(--ct1)]'
              }`}
              style={filter === f.value ? { background: f.color } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-5">

        {/* Period summary */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Done',       value: periodStats.completed, color: '#22C55E' },
            { label: 'Missed',     value: periodStats.missed,    color: '#EF4444' },
            { label: 'Reps',       value: periodStats.totalReps, color: '#FACC15' },
            { label: 'Rate',       value: `${periodStats.rate}%`, color: periodStats.rate >= 60 ? '#22C55E' : '#EF4444' },
          ].map(t => (
            <div key={t.label} className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-3 text-center">
              <p className="font-bold text-base" style={{ color: t.color }}>{t.value}</p>
              <p className="text-[var(--ct2)] text-xs mt-0.5">{t.label}</p>
            </div>
          ))}
        </div>

        {/* Calendar view */}
        {view === 'calendar' && (
          <div className="space-y-4">
            <CalendarView
              statsMap={statsMap}
              selectedDate={selectedDate}
              onSelect={date => { setSelectedDate(date); setView('day'); }}
            />
            <p className="text-[var(--ct2)] text-xs text-center">Tap a day to see its sessions</p>
          </div>
        )}

        {/* Day view */}
        {view === 'day' && (
          <>
            {byDate[selectedDate] ? (
              <DayCard
                date={selectedDate}
                sessions={byDate[selectedDate]}
                stats={statsMap[selectedDate] ?? null}
                filterStatus={filter}
                enabledExercises={settings.enabledExercises}
                customExerciseLabels={settings.customExerciseLabels}
              />
            ) : (
              <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-8 text-center">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-[var(--ct0)] text-sm font-semibold">No sessions logged</p>
                <p className="text-[var(--ct2)] text-xs mt-1">No data for this day yet.</p>
              </div>
            )}
          </>
        )}

        {/* All view */}
        {view === 'all' && (
          <>
            {allDates.length === 0 ? (
              <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-8 text-center">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-[var(--ct0)] text-sm font-semibold">No history yet</p>
                <p className="text-[var(--ct2)] text-xs mt-1">Complete your first session to see it here.</p>
              </div>
            ) : (
              allDates.map(date => (
                <DayCard
                  key={date}
                  date={date}
                  sessions={byDate[date]}
                  stats={statsMap[date] ?? null}
                  filterStatus={filter}
                  enabledExercises={settings.enabledExercises}
                  customExerciseLabels={settings.customExerciseLabels}
                />
              ))
            )}
          </>
        )}

        {/* Insights */}
        <HistoryInsights allStats={allStats} streak={streak} />

      </main>

      <NavTabs />
    </div>
  );
}
