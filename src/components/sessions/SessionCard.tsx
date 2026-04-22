import { useState } from 'react';
import type { SessionLog } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { formatTime } from '@/lib/sessions';
import { LogEditor } from './LogEditor';
import { Modal } from '@/components/ui/Modal';

interface SessionCardProps {
  session: SessionLog;
  onSave?: (id: string, completedReps: number, notes: string) => void;
  readonly?: boolean;
}

export function SessionCard({ session: s, onSave, readonly = false }: SessionCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div
        className="bg-[var(--c4)] border border-[var(--c5)] rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:border-[var(--ca)] transition-colors"
        onClick={() => !readonly && setEditing(true)}
      >
        <div className="w-16 shrink-0">
          <p className="text-xs text-[var(--ct1)]">{s.date}</p>
          <p className="text-sm text-[var(--ct0)] font-medium">{formatTime(s.scheduledHour, s.scheduledMinute ?? 0)}</p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[var(--ct0)] text-sm">
            Target: <span className="font-semibold">{s.targetReps} reps</span>
            {s.completedReps !== null && (
              <span className="text-[var(--ct1)]"> · Done: {s.completedReps}</span>
            )}
          </p>
          {s.notes && (
            <p className="text-xs text-[var(--ct1)] truncate mt-0.5">{s.notes}</p>
          )}
        </div>

        <Badge status={s.status as any} />
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={`${formatTime(s.scheduledHour, s.scheduledMinute ?? 0)} — ${s.date}`}
      >
        <LogEditor
          session={s}
          onSave={(reps, notes) => {
            onSave?.(s.id, reps, notes);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </>
  );
}
