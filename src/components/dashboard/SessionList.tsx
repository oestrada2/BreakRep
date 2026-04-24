import type { SessionLog, EnabledExercises } from '@/types';
import { formatTime } from '@/lib/sessions';

interface SessionListProps {
  sessions: SessionLog[];
  enabledExercises: EnabledExercises;
  targetReps: number;
  repOverrides?: Record<string, number>;
  excludeId?: string;
  onComplete: (id: string, pushups: number, squats: number, situps: number) => void;
  onUndo: (id: string) => void;
  onSkip: (id: string) => void;
  onSnooze: (id: string) => void;
}

const STATUS_CONFIG = {
  completed: { dot: 'bg-gradient-to-br from-[#22C55E] to-[#16A34A]',             label: 'Done',    labelColor: 'text-[#22C55E]' },
  missed:    { dot: 'bg-[#EF4444]',                                               label: 'Missed',  labelColor: 'text-[#EF4444]' },
  skipped:   { dot: 'bg-[#FB923C]',                                               label: 'Skipped', labelColor: 'text-[#FB923C]' },
  snoozed:   { dot: 'bg-[#FACC15]',                                               label: 'Snoozed', labelColor: 'text-[#FACC15]' },
  pending:   { dot: 'border-2 border-[var(--c5)] bg-transparent',                 label: 'Up next', labelColor: 'text-[var(--ct2)]' },
};

const DEFAULT_EXERCISES = { pushups: true, squats: true, situps: true };

export function SessionList({ sessions, enabledExercises, targetReps, repOverrides, excludeId, onComplete, onUndo, onSkip, onSnooze }: SessionListProps) {
  const enabled = enabledExercises ?? DEFAULT_EXERCISES;
  const visible = sessions.filter(s => s.id !== excludeId).slice(0, 12);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[var(--ct0)] text-sm font-semibold">Today's Sessions</p>
        <span className="text-[var(--ct2)] text-xs">
          {sessions.filter(s => s.status === 'completed').length}/{sessions.length} done
        </span>
      </div>

      <div className="space-y-1.5">
        {visible.map(s => {
          const cfg       = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
          const canAct    = s.status === 'pending' || s.status === 'snoozed' || s.status === 'missed';
          const canSnooze = s.status === 'pending' || s.status === 'snoozed';
          const canUndo   = s.status === 'completed' || s.status === 'skipped' || s.status === 'snoozed';

          return (
            <div key={s.id} className="flex items-center gap-2.5 bg-gradient-to-r from-[var(--c2)] to-[var(--c0)] rounded-xl px-3 py-2.5 border border-[var(--c5)]/40">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
              <span className="text-[var(--ct1)] text-xs font-medium flex-1">
                {formatTime(s.scheduledHour, s.scheduledMinute ?? 0)}
              </span>

              {canAct ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onComplete(
                      s.id,
                      enabled.pushups ? (repOverrides?.pushups ?? targetReps) : 0,
                      enabled.squats  ? (repOverrides?.squats  ?? targetReps) : 0,
                      enabled.situps  ? Math.max(repOverrides?.situps ?? targetReps, 60) : 0,
                    )}
                    className="px-3 py-1 bg-gradient-to-r from-[#16A34A] to-[#22C55E] text-[#09090B] rounded-lg text-xs font-bold hover:from-[#15803D] hover:to-[#16A34A] transition-all shadow-sm shadow-green-500/20"
                  >Done</button>
                  {canSnooze && (
                    <button
                      onClick={() => onSnooze(s.id)}
                      className="px-2 py-1 bg-[#FACC15]/10 text-[#FACC15] rounded-lg text-xs font-semibold border border-[#FACC15]/20 hover:bg-[#FACC15]/20 transition-colors"
                    >Z</button>
                  )}
                  <button
                    onClick={() => onSkip(s.id)}
                    className="px-2 py-1 bg-[var(--c3)] text-[var(--ct2)] rounded-lg text-xs font-semibold border border-[var(--c5)] hover:text-[var(--ct1)] transition-colors"
                  >Skip</button>
                </div>
              ) : (
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
          );
        })}
      </div>
    </div>
  );
}
