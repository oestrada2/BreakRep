import { useState, useMemo } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { NavTabs } from '@/components/layout/NavTabs';
import { WeekStrip } from '@/components/history/WeekStrip';
import { CalendarView } from '@/components/history/CalendarView';

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function offsetISO(days: number) {
  return toLocalISO(new Date(Date.now() + days * 86_400_000));
}

export default function Logs() {
  const { logs, allStats, streak, settings } = useAppState();

  const todayISO     = toLocalISO(new Date());
  const yesterdayISO = offsetISO(-1);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [view, setView] = useState<'week' | 'calendar'>('week');

  const statsMap = useMemo(() => {
    const m: Record<string, typeof allStats[0]> = {};
    allStats.forEach(s => { m[s.date] = s; });
    return m;
  }, [allStats]);

  // ── This week vs last week ─────────────────────────────────────────────────
  const thisWeekStats = useMemo(() =>
    allStats.filter(s => s.date >= offsetISO(-6)),
  [allStats]);

  const lastWeekStats = useMemo(() =>
    allStats.filter(s => s.date >= offsetISO(-13) && s.date <= offsetISO(-7)),
  [allStats]);

  const thisWeek = useMemo(() => ({
    done: thisWeekStats.reduce((n, s) => n + s.completed, 0),
    reps: thisWeekStats.reduce((n, s) => n + s.totalReps, 0),
    pushupReps: thisWeekStats.reduce((n, s) => n + s.pushupReps, 0),
    squatReps:  thisWeekStats.reduce((n, s) => n + s.squatReps, 0),
    situpReps:  thisWeekStats.reduce((n, s) => n + s.situpReps, 0),
    rate: thisWeekStats.length
      ? Math.round(thisWeekStats.reduce((n, s) => n + s.complianceRate, 0) / thisWeekStats.length * 100)
      : 0,
  }), [thisWeekStats]);

  const lastWeekReps = useMemo(() =>
    lastWeekStats.reduce((n, s) => n + s.totalReps, 0),
  [lastWeekStats]);

  const repDiff = thisWeek.reps - lastWeekReps;

  // ── All-time ───────────────────────────────────────────────────────────────
  const totalReps         = useMemo(() => allStats.reduce((n, s) => n + s.totalReps, 0),   [allStats]);
  const allTimePushupReps = useMemo(() => allStats.reduce((n, s) => n + s.pushupReps, 0),  [allStats]);
  const allTimeSquatReps  = useMemo(() => allStats.reduce((n, s) => n + s.squatReps, 0),   [allStats]);
  const allTimeSitupReps  = useMemo(() => allStats.reduce((n, s) => n + s.situpReps, 0),   [allStats]);

  const personalBest = useMemo(() =>
    Math.max(0, ...Object.values(logs).map(s => s.completedReps ?? 0)),
  [logs]);

  const consistency = useMemo(() =>
    allStats.length
      ? Math.round(allStats.reduce((n, s) => n + s.complianceRate, 0) / allStats.length * 100)
      : 0,
  [allStats]);

  // ── Weekly streak dots (Mon–Sun) ───────────────────────────────────────────
  const threshold = settings.deload.complianceThreshold;

  const streakDots = useMemo(() => {
    const dow = new Date().getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    return Array.from({ length: 7 }, (_, i) => {
      const date = offsetISO(mondayOffset + i);
      if (date > todayISO) return 'future' as const;
      const stat = statsMap[date];
      if (!stat) return 'empty' as const;
      return stat.complianceRate >= threshold ? 'hit' as const : 'miss' as const;
    });
  }, [statsMap, todayISO, threshold]);

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="min-h-screen bg-[var(--c0)] text-[var(--ct0)] font-sans pb-20">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[var(--c0)]/95 backdrop-blur border-b border-[var(--c2)] px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--ct0)] text-xl font-bold">History</h1>
            <p className="text-[var(--ct2)] text-xs mt-0.5">Your stats and progress</p>
          </div>
          <div className="flex bg-[var(--c2)] border border-[var(--c5)] rounded-xl p-0.5 gap-0.5">
            {([['week', 'Week'], ['calendar', 'Calendar']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  view === v ? 'bg-[#F97316] text-[#09090B]' : 'text-[var(--ct2)] hover:text-[var(--ct1)]'
                }`}>{label}
              </button>
            ))}
          </div>
        </div>
        {view === 'week' && (
          <WeekStrip selectedDate={selectedDate} statsMap={statsMap} onSelect={setSelectedDate} />
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">

        {/* ── Calendar view ── */}
        {view === 'calendar' && (
          <CalendarView
            statsMap={statsMap}
            selectedDate={selectedDate}
            onSelect={date => setSelectedDate(date)}
          />
        )}

        {/* ── Streak hero ── */}
        <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#FACC15]/10 flex items-center justify-center text-3xl shrink-0">🔥</div>
              <div>
                <p className="text-[var(--ct0)] text-4xl font-black leading-none">
                  {streak}
                  <span className="text-lg font-semibold text-[var(--ct2)] ml-1.5">day{streak !== 1 ? 's' : ''}</span>
                </p>
                <p className="text-[var(--ct2)] text-xs mt-1">Current streak</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <p className="text-[var(--ct2)] text-[10px] uppercase tracking-widest">This week</p>
              <div className="flex gap-1">
                {DAY_LABELS.map((label, i) => {
                  const dot = streakDots[i];
                  return (
                    <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                      dot === 'hit'  ? 'bg-[#22C55E] text-white' :
                      dot === 'miss' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                                       'bg-[var(--c4)] text-[var(--ct2)]'
                    }`}>
                      {dot === 'hit' ? '✓' : label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {streak === 0 && allStats.length > 0 && (
            <p className="text-[var(--ct2)] text-xs mt-3 pt-3 border-t border-[var(--c5)]">
              Complete {Math.round(threshold * 100)}%+ of today's sessions to start a streak.
            </p>
          )}
        </div>

        {/* ── This week ── */}
        <div>
          <p className="text-[var(--ct2)] text-[10px] font-bold uppercase tracking-widest mb-2">This week</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-3.5 text-center">
              <p className="text-[#22C55E] font-bold text-2xl leading-none">{thisWeek.done}</p>
              <p className="text-[var(--ct2)] text-xs mt-1.5">Sessions done</p>
            </div>
            <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-3.5 text-center">
              <p className="text-[#F97316] font-bold text-2xl leading-none">{thisWeek.reps}</p>
              {lastWeekReps > 0 && (
                <p className={`text-[10px] font-semibold mt-0.5 ${repDiff >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {repDiff >= 0 ? '↑' : '↓'} {Math.abs(repDiff)} vs last week
                </p>
              )}
              {thisWeek.reps > 0 && (
                <p className="text-[var(--ct2)] text-[10px] mt-1">
                  {[
                    thisWeek.pushupReps > 0 ? `💪 ${thisWeek.pushupReps}` : null,
                    thisWeek.squatReps  > 0 ? `🦵 ${thisWeek.squatReps}`  : null,
                    thisWeek.situpReps  > 0 ? `⏱️ ${thisWeek.situpReps}s` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="text-[var(--ct2)] text-xs mt-1.5">Reps</p>
            </div>
            <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-3.5 text-center">
              <p className={`font-bold text-2xl leading-none ${
                thisWeek.rate >= 60 ? 'text-[#22C55E]' : thisWeek.rate >= 30 ? 'text-[#FACC15]' : 'text-[#EF4444]'
              }`}>{thisWeek.rate}%</p>
              <p className="text-[var(--ct2)] text-xs mt-1.5">Completion</p>
            </div>
          </div>
        </div>

        {/* ── All time ── */}
        <div>
          <p className="text-[var(--ct2)] text-[10px] font-bold uppercase tracking-widest mb-2">All time</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-3.5 text-center">
              <p className="text-[#22C55E] font-bold text-2xl leading-none">{totalReps}</p>
              {totalReps > 0 && (
                <p className="text-[var(--ct2)] text-[10px] mt-1">
                  {[
                    allTimePushupReps > 0 ? `💪 ${allTimePushupReps}` : null,
                    allTimeSquatReps  > 0 ? `🦵 ${allTimeSquatReps}`  : null,
                    allTimeSitupReps  > 0 ? `⏱️ ${allTimeSitupReps}s` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="text-[var(--ct2)] text-xs mt-1.5">Total reps</p>
            </div>
            <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-3.5 text-center">
              <p className="text-[var(--ca)] font-bold text-2xl leading-none">{personalBest > 0 ? personalBest : '—'}</p>
              <p className="text-[var(--ct2)] text-xs mt-1.5">Best session</p>
            </div>
            <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-3.5 text-center">
              <p className={`font-bold text-2xl leading-none ${
                consistency >= 60 ? 'text-[#22C55E]' : consistency >= 30 ? 'text-[#FACC15]' : 'text-[#EF4444]'
              }`}>{consistency}%</p>
              <p className="text-[var(--ct2)] text-xs mt-1.5">Consistency</p>
            </div>
          </div>
        </div>

      </main>
      <NavTabs />
    </div>
  );
}
