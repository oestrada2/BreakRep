import type { SessionLog, EnabledExercises } from '@/types';
import { formatTime } from '@/lib/sessions';
import { useState } from 'react';

interface SessionListProps {
  sessions: SessionLog[];
  enabledExercises: EnabledExercises;
  customExerciseLabels?: Record<string, string>;
  onComplete: (id: string, pushups: number, squats: number, situps: number) => void;
  onUndo: (id: string) => void;
  onSkip: (id: string) => void;
  onSnooze: (id: string) => void;
}

const STATUS_CONFIG = {
  completed: { dot: 'bg-[#22C55E]',                            label: 'Done',    labelColor: 'text-[#22C55E]' },
  missed:    { dot: 'bg-[#EF4444]',                            label: 'Missed',  labelColor: 'text-[#EF4444]' },
  skipped:   { dot: 'bg-[#FB923C]',                            label: 'Skipped', labelColor: 'text-[#FB923C]' },
  snoozed:   { dot: 'bg-[#FACC15]',                            label: 'Snoozed', labelColor: 'text-[#FACC15]' },
  pending:   { dot: 'bg-[var(--c5)] border border-[var(--ca)]/40', label: 'Up next', labelColor: 'text-[var(--ct2)]' },
};

const BUILTIN_EXERCISES = [
  { key: 'pushups', label: 'Push-ups', emoji: '💪' },
  { key: 'squats',  label: 'Squats',   emoji: '🦵' },
  { key: 'situps',  label: 'Sit-ups',  emoji: '🔥' },
];

const DEFAULT_EXERCISES = { pushups: true, squats: true, situps: true };

export function SessionList({ sessions, enabledExercises, customExerciseLabels, onComplete, onUndo, onSkip, onSnooze }: SessionListProps) {
  const enabled = enabledExercises ?? DEFAULT_EXERCISES;
  const allExercises = [
    ...BUILTIN_EXERCISES.filter(ex => enabled[ex.key]),
    ...Object.entries(customExerciseLabels ?? {})
      .filter(([key]) => enabled[key] !== false)
      .map(([key, label]) => ({ key, label, emoji: '🏋️' })),
  ];
  // editReps keyed by `${sessionId}-${exercise}`
  const [editReps, setEditReps] = useState<Record<string, string>>({});

  const visible = sessions.slice(0, 12);

  function getRep(id: string, key: string, fallback: number) {
    return editReps[`${id}-${key}`] ?? String(fallback);
  }
  function setRep(id: string, key: string, val: string) {
    setEditReps(r => ({ ...r, [`${id}-${key}`]: val }));
  }
  function parseRep(id: string, key: string, fallback: number) {
    const p = parseInt(editReps[`${id}-${key}`] ?? String(fallback), 10);
    return isNaN(p) ? fallback : p;
  }
  function clearReps(id: string) {
    setEditReps(r => {
      const n = { ...r };
      allExercises.forEach(ex => delete n[`${id}-${ex.key}`]);
      return n;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[var(--ct0)] text-sm font-semibold">Today's Sessions</p>
        <span className="text-[var(--ct2)] text-xs">
          {sessions.filter(s => s.status === 'completed').length}/{sessions.length} done
        </span>
      </div>

      <div className="space-y-2">
        {visible.map(s => {
          const cfg    = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
          const canAct = s.status === 'pending' || s.status === 'snoozed';
          const canUndo = s.status === 'completed' || s.status === 'skipped' || s.status === 'snoozed';

          return (
            <div key={s.id} className="bg-[var(--c0)]/40 rounded-xl px-3 py-2.5">
              {/* Row header: dot · time · status/undo */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full shrink-0 ${cfg.dot}`} />
                <span className="text-[var(--ct2)] text-xs font-medium flex-1">
                  {formatTime(s.scheduledHour, s.scheduledMinute ?? 0)}
                </span>
                {!canAct && (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${cfg.labelColor}`}>{cfg.label}</span>
                    {canUndo && (
                      <button
                        onClick={() => onUndo(s.id)}
                        className="text-xs text-[var(--ct2)] hover:text-[#EF4444] transition-colors"
                        title="Undo"
                      >↩</button>
                    )}
                  </div>
                )}
              </div>

              {/* Exercise rows — built-in enabled + custom */}
              <div className="space-y-1.5">
                {allExercises.map(ex => {
                  const completedVal =
                    ex.key === 'pushups' ? s.completedReps :
                    ex.key === 'squats'  ? s.completedSquatReps :
                    ex.key === 'situps'  ? s.completedSitupReps :
                                          null; // custom — not stored in log
                  const repVal = getRep(s.id, ex.key, s.targetReps);

                  return (
                    <div key={ex.key} className="flex items-center gap-2">
                      <span className="text-base w-5 text-center">{ex.emoji}</span>
                      <span className="text-[var(--ct1)] text-xs flex-1">{ex.label}</span>

                      {canAct ? (
                        /* stepper */
                        <div className="flex items-center bg-[var(--c4)] border border-[var(--c5)] rounded-lg overflow-hidden">
                          <button
                            onClick={() => setRep(s.id, ex.key, String(Math.max(0, parseInt(repVal) - 1)))}
                            className="px-1.5 py-1 text-[var(--ct2)] hover:text-[var(--ct0)] text-xs leading-none"
                          >−</button>
                          <span className="text-[var(--ct0)] text-xs font-bold w-6 text-center">{repVal}</span>
                          <button
                            onClick={() => setRep(s.id, ex.key, String(parseInt(repVal) + 1))}
                            className="px-1.5 py-1 text-[var(--ct2)] hover:text-[var(--ct0)] text-xs leading-none"
                          >+</button>
                        </div>
                      ) : (
                        /* completed / missed display */
                        <span className={`text-xs font-semibold tabular-nums ${
                          s.status === 'completed' ? 'text-[#22C55E]' : 'text-[var(--ct2)]'
                        }`}>
                          {s.status === 'completed' && completedVal !== null && completedVal !== undefined
                            ? `${completedVal} reps`
                            : `${s.targetReps} reps`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action buttons for pending/snoozed */}
              {canAct && (
                <div className="flex gap-1.5 mt-2.5">
                  <button
                    onClick={() => {
                      onComplete(
                        s.id,
                        enabled.pushups ? parseRep(s.id, 'pushups', s.targetReps) : 0,
                        enabled.squats  ? parseRep(s.id, 'squats',  s.targetReps) : 0,
                        enabled.situps  ? parseRep(s.id, 'situps',  s.targetReps) : 0,
                      );
                      clearReps(s.id);
                    }}
                    className="flex-1 py-1.5 bg-[#22C55E] text-[#0B1C2D] rounded-lg text-xs font-bold hover:bg-[#16A34A] transition-colors"
                  >Done</button>
                  <button
                    onClick={() => onSnooze(s.id)}
                    className="px-3 py-1.5 bg-[#FACC15]/10 text-[#FACC15] rounded-lg text-xs font-semibold border border-[#FACC15]/20 hover:bg-[#FACC15]/20 transition-colors"
                    title="Snooze"
                  >Z</button>
                  <button
                    onClick={() => onSkip(s.id)}
                    className="px-3 py-1.5 bg-[#FB923C]/10 text-[#FB923C] rounded-lg text-xs font-semibold border border-[#FB923C]/20 hover:bg-[#FB923C]/20 transition-colors"
                  >Skip</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
