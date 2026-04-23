import { useState, useEffect } from 'react';
import type { SessionLog, EnabledExercises } from '@/types';
import { sessionFireTime, formatTime } from '@/lib/sessions';

interface NextSessionCardProps {
  sessions: SessionLog[];
  enabledExercises: EnabledExercises;
  customExerciseLabels?: Record<string, string>;
  targetReps: number;
  repOverrides?: Record<string, number>;
  onRepChange?: (key: string, value: number) => void;
  onComplete: (id: string, pushups: number, squats: number, situps: number) => void;
  onSnooze: (id: string) => void;
  onSkip: (id: string) => void;
}

function useCountdownToSession(session: SessionLog | null): string {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!session) { setDisplay(''); return; }

    const target = sessionFireTime(session.date, session.scheduledHour, session.scheduledMinute ?? 0);

    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setDisplay('Now'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      if (h > 0) setDisplay(`${h}h ${String(m).padStart(2, '0')}m`);
      else if (m > 0) setDisplay(`${m}m ${String(s).padStart(2, '0')}s`);
      else setDisplay(`${s}s`);
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [session]);

  return display;
}

const BUILTIN_EXERCISES = [
  { key: 'pushups', label: 'Push-ups', emoji: '💪' },
  { key: 'squats',  label: 'Squats',   emoji: '🦵' },
  { key: 'situps',  label: 'Plank',    emoji: '⏱️' },
];

const DEFAULT_EXERCISES = { pushups: true, squats: true, situps: true };

export function NextSessionCard({ sessions, enabledExercises, customExerciseLabels, targetReps, repOverrides, onRepChange, onComplete, onSnooze, onSkip }: NextSessionCardProps) {
  const enabled = enabledExercises ?? DEFAULT_EXERCISES;
  const allExercises = [
    ...BUILTIN_EXERCISES.filter(ex => enabled[ex.key]),
    ...Object.entries(customExerciseLabels ?? {})
      .filter(([key]) => enabled[key] !== false)
      .map(([key, label]) => ({ key, label, emoji: '🏋️' })),
  ];
  const [reps, setReps] = useState<Record<string, string>>({});

  const next = sessions.find(s => s.status === 'pending' || s.status === 'snoozed') ?? null;
  const countdown = useCountdownToSession(next);

  if (!next) {
    const allDone = sessions.length > 0 && sessions.every(s => s.status === 'completed' || s.status === 'skipped');
    return (
      <div className="bg-gradient-to-br from-[#0D2A1A] to-[var(--c2)] border border-[#22C55E]/30 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#22C55E]/20 flex items-center justify-center text-2xl">🎉</div>
          <div>
            <p className="text-[#22C55E] font-bold text-base">
              {allDone ? 'All sessions done!' : 'No sessions scheduled'}
            </p>
            <p className="text-[var(--ct1)] text-xs mt-0.5">
              {allDone ? 'Great work today. Rest up.' : 'Check your reminder settings.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isReady = countdown === 'Now' || (() => {
    const fireAt = sessionFireTime(next.date, next.scheduledHour, next.scheduledMinute ?? 0);
    return Date.now() >= fireAt.getTime();
  })();

  function getRepDefault(key: string) {
    const override = repOverrides?.[key];
    if (key === 'situps') return Math.max(override ?? targetReps, 60);
    return override ?? targetReps;
  }
  function getReps(key: string) {
    return reps[key] !== undefined ? reps[key] : String(getRepDefault(key));
  }
  function setRep(key: string, val: string) {
    setReps(r => ({ ...r, [key]: val }));
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) onRepChange?.(key, parsed);
  }
  function adjustRep(key: string, delta: number) {
    const cur = parseInt(getReps(key), 10);
    const next = Math.max(0, (isNaN(cur) ? getRepDefault(key) : cur) + delta);
    setReps(r => ({ ...r, [key]: String(next) }));
    onRepChange?.(key, next);
  }
  function parseRep(key: string) {
    const p = parseInt(getReps(key), 10);
    return isNaN(p) ? getRepDefault(key) : p;
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-2xl ${
      isReady
        ? 'bg-gradient-to-br from-[#1A2A0D] via-[#0D2218] to-[var(--c2)] border border-[#22C55E]/40'
        : next.status === 'snoozed'
        ? 'bg-gradient-to-br from-[#1A1A0D] to-[var(--c2)] border border-[#FACC15]/30'
        : 'bg-gradient-to-br from-[#0D1A2A] to-[var(--c0)] border border-[var(--c5)]'
    }`}>
      {/* Glow accent */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-20 ${
        isReady ? 'bg-[#22C55E]' : next.status === 'snoozed' ? 'bg-[#FACC15]' : 'bg-[var(--ca)]'
      }`} />

      <div className="relative p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ct2)]">Next Session</span>
              {next.status === 'snoozed' && (
                <span className="text-xs bg-[#FACC15]/20 text-[#FACC15] px-2 py-0.5 rounded-full font-semibold">Snoozed</span>
              )}
            </div>
            <p className="text-[var(--ct0)] text-xl font-bold">{formatTime(next.scheduledHour, next.scheduledMinute ?? 0)}</p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
            isReady
              ? 'bg-[#22C55E] text-[#0B1C2D] animate-pulse'
              : 'bg-[var(--c3)] text-[var(--ca)] border border-[var(--ca)]/30'
          }`}>
            {isReady ? '● Ready now' : `⏱ ${countdown}`}
          </div>
        </div>

        {/* Exercise rows with steppers */}
        <div className="space-y-2 mb-4">
          {allExercises.map(ex => (
            <div key={ex.key} className="flex items-center gap-3 bg-[var(--c2)]/60 rounded-xl px-3 py-2.5">
              <span className="text-xl w-7 text-center">{ex.emoji}</span>
              <span className="text-[var(--ct0)] text-sm font-semibold flex-1">{ex.label}</span>
              <div className="flex items-center bg-[var(--c4)] border border-[var(--c5)] rounded-lg overflow-hidden">
                <button
                  onClick={() => adjustRep(ex.key, -1)}
                  className="w-8 h-8 flex items-center justify-center text-[var(--ct2)] hover:text-[var(--ct0)] font-bold transition-colors"
                >−</button>
                <input
                  type="number"
                  min={0}
                  value={getReps(ex.key)}
                  onChange={e => setRep(ex.key, e.target.value)}
                  className="w-10 text-center bg-transparent text-[var(--ct0)] font-bold text-sm outline-none"
                />
                <button
                  onClick={() => adjustRep(ex.key, 1)}
                  className="w-8 h-8 flex items-center justify-center text-[var(--ct2)] hover:text-[var(--ct0)] font-bold transition-colors"
                >+</button>
              </div>
              <span className="text-[var(--ct2)] text-xs w-7">{ex.key === 'situps' ? 'sec' : 'reps'}</span>
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => {
            onComplete(
              next.id,
              enabled.pushups ? parseRep('pushups') : 0,
              enabled.squats  ? parseRep('squats')  : 0,
              enabled.situps  ? parseRep('situps')  : 0,
            );
            setReps({});
          }}
          className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg mb-3 ${
            isReady
              ? 'bg-[#22C55E] text-[#0B1C2D] shadow-green-500/25 hover:bg-[#16A34A]'
              : 'bg-[#FACC15] text-[#0B1C2D] shadow-yellow-500/25 hover:bg-[#EAB308]'
          }`}
        >
          {isReady ? '✓ Complete Session' : 'Mark as Done Early'}
        </button>

        {/* Secondary actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onSnooze(next.id)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[var(--c2)] border border-[var(--c5)] text-[#FACC15] hover:border-[#FACC15]/50 transition-colors"
          >⏰ Snooze</button>
          <button
            onClick={() => onSkip(next.id)}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-[var(--c2)] border border-[var(--c5)] text-[#FB923C] hover:border-[#FB923C]/50 transition-colors"
          >→ Skip</button>
        </div>
      </div>
    </div>
  );
}
