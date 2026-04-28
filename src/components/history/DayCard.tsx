import { useState } from 'react';
import type { SessionLog, DailyStats, EnabledExercises } from '@/types';
import { formatTime } from '@/lib/sessions';

interface DayCardProps {
  date: string;
  sessions: SessionLog[];
  stats: DailyStats | null;
  filterStatus: string;
  enabledExercises?: EnabledExercises;
  customExerciseLabels?: Record<string, string>;
  customExerciseTrackingTypes?: Record<string, 'reps' | 'time'>;
  /** When true, sessions start collapsed with an expand prompt */
  collapsible?: boolean;
}

const STATUS_CONFIG = {
  completed: { bg: 'bg-[#22C55E]/10', border: 'border-[#22C55E]/20', dot: 'bg-[#22C55E]', text: 'text-[#22C55E]', label: 'Done' },
  missed:    { bg: 'bg-[#EF4444]/10', border: 'border-[#EF4444]/20', dot: 'bg-[#EF4444]', text: 'text-[#EF4444]', label: 'Missed' },
  skipped:   { bg: 'bg-[#FB923C]/10', border: 'border-[#FB923C]/20', dot: 'bg-[#FB923C]', text: 'text-[#FB923C]', label: 'Skipped' },
  snoozed:   { bg: 'bg-[#FACC15]/10', border: 'border-[#FACC15]/20', dot: 'bg-[#FACC15]', text: 'text-[#FACC15]', label: 'Snoozed' },
  pending:   { bg: 'bg-[var(--c5)]/30', border: 'border-[var(--c5)]',  dot: 'bg-[var(--ct2)]', text: 'text-[var(--ct2)]', label: 'Pending' },
};

function formatDateLabel(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const yestStr  = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
  if (dateStr === todayStr) return 'Today';
  if (dateStr === yestStr)  return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function DayCard({ date, sessions, stats, filterStatus, enabledExercises, customExerciseLabels, customExerciseTrackingTypes, collapsible = false }: DayCardProps) {
  const [expanded, setExpanded] = useState(!collapsible);

  const pushupLabel = customExerciseLabels?.['pushups'] ?? 'Push-ups';
  const squatLabel  = customExerciseLabels?.['squats']  ?? 'Squats';
  const plankLabel  = customExerciseLabels?.['situps']  ?? 'Plank';

  const builtinExercises = [
    { key: 'pushups', emoji: '💪', label: pushupLabel, getCompleted: (s: SessionLog) => s.completedReps },
    { key: 'squats',  emoji: '🦵', label: squatLabel,  getCompleted: (s: SessionLog) => s.completedSquatReps },
    { key: 'situps',  emoji: '⏱️', label: plankLabel,  getCompleted: (s: SessionLog) => s.completedSitupReps },
  ].filter(ex => !enabledExercises || enabledExercises[ex.key] !== false);

  const customExercises = Object.entries(customExerciseLabels ?? {})
    .filter(([key]) => key.startsWith('custom_') && (!enabledExercises || enabledExercises[key] !== false))
    .map(([key, label]) => ({
      key,
      emoji: (customExerciseTrackingTypes?.[key] ?? 'reps') === 'time' ? '⏱️' : '🏋️',
      label,
      trackingType: (customExerciseTrackingTypes?.[key] ?? 'reps') as 'reps' | 'time',
      getCompleted: (s: SessionLog) => s.customExerciseReps?.[key] ?? null,
    }));

  const filtered = filterStatus === 'all'
    ? sessions
    : sessions.filter(s => s.status === filterStatus);

  if (filtered.length === 0) return null;

  const pct = stats ? Math.round(stats.complianceRate * 100) : 0;
  const statusLabel = pct >= 80 ? 'Great day' : pct >= 60 ? 'On Track' : pct >= 30 ? 'Needs Work' : 'Missed most';
  const statusColor = pct >= 60 ? '#22C55E' : pct >= 30 ? '#FACC15' : '#EF4444';

  return (
    <div className="space-y-2">
      {/* Day header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[var(--ct0)] text-sm font-semibold">{formatDateLabel(date)}</p>
          {stats && (
            <p className="text-[var(--ct2)] text-xs mt-0.5">
              {stats.completed}/{stats.totalSessions} sessions
              {(() => {
                const parts: string[] = [];
                if (stats.pushupReps > 0) parts.push(`💪 ${stats.pushupReps} ${pushupLabel.toLowerCase()}`);
                if (stats.squatReps  > 0) parts.push(`🦵 ${stats.squatReps} ${squatLabel.toLowerCase()}`);
                if (stats.situpReps  > 0) parts.push(`⏱️ ${stats.situpReps}s ${plankLabel.toLowerCase()}`);
                Object.entries(stats.customExerciseStats ?? {}).forEach(([key, val]) => {
                  if (val > 0) {
                    const label = customExerciseLabels?.[key] ?? key;
                    const isTime = (customExerciseTrackingTypes?.[key] ?? 'reps') === 'time';
                    parts.push(`${isTime ? '⏱️' : '🏋️'} ${val}${isTime ? ' min' : ' reps'} ${label.toLowerCase()}`);
                  }
                });
                return parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
              })()}
            </p>
          )}
        </div>
        {stats && (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-[var(--c4)] rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: statusColor }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        )}
      </div>

      {/* Collapsed prompt */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full bg-[var(--c2)] border border-[var(--c5)] rounded-2xl px-4 py-4 flex items-center justify-between hover:border-[var(--ca)]/40 transition-colors"
        >
          <span className="text-[var(--ct1)] text-sm">
            View all {filtered.length} session{filtered.length !== 1 ? 's' : ''}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[var(--ct2)]">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      {/* Session rows */}
      {expanded && (
        <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl overflow-hidden">
          {filtered.map((s, i) => {
            const cfg = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;

            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < filtered.length - 1 ? 'border-b border-[var(--c4)]' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

                <span className="text-[var(--ct2)] text-xs w-14 shrink-0">
                  {formatTime(s.scheduledHour, s.scheduledMinute ?? 0)}
                </span>

                <div className="flex-1 min-w-0 space-y-0.5">
                  {[...builtinExercises, ...customExercises]
                    .map(ex => ({ ...ex, completed: ex.getCompleted(s) }))
                    .filter(ex => s.status !== 'completed' || ex.key.startsWith('custom_') || (ex.completed != null && ex.completed > 0))
                    .map(ex => {
                      const isTime = ex.key === 'situps' || ('trackingType' in ex && ex.trackingType === 'time');
                      return (
                        <div key={ex.key} className="flex items-center gap-1.5">
                          <span className="text-xs">{ex.emoji}</span>
                          <span className="text-[var(--ct1)] text-xs flex-1">{ex.label}</span>
                          <span className={`text-xs font-semibold tabular-nums ${s.status === 'completed' ? 'text-[#22C55E]' : 'text-[var(--ct2)]'}`}>
                            {s.status === 'completed' && ex.completed != null ? ex.completed : s.targetReps} {isTime ? 'sec' : 'reps'}
                          </span>
                        </div>
                      );
                    })}
                  {s.notes && (
                    <p className="text-[var(--ct2)] text-xs truncate pt-0.5">{s.notes}</p>
                  )}
                </div>

                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} ${cfg.border} border shrink-0`}>
                  {cfg.label}
                </span>
              </div>
            );
          })}

          {/* Collapse button */}
          {collapsible && (
            <button
              onClick={() => setExpanded(false)}
              className="w-full px-4 py-3 border-t border-[var(--c4)] text-[var(--ct2)] text-xs font-semibold hover:text-[var(--ct1)] transition-colors flex items-center justify-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
              Collapse
            </button>
          )}
        </div>
      )}
    </div>
  );
}
