import { useState } from 'react';
import type { SessionLog } from '@/types';
import { Button } from '@/components/ui/Button';

interface LogEditorProps {
  session: SessionLog;
  onSave: (completedReps: number, notes: string) => void;
  onCancel: () => void;
}

export function LogEditor({ session: s, onSave, onCancel }: LogEditorProps) {
  const [reps, setReps] = useState(String(s.completedReps ?? s.targetReps));
  const [notes, setNotes] = useState(s.notes ?? '');

  const handleSave = () => {
    const parsed = parseInt(reps, 10);
    if (isNaN(parsed) || parsed < 0) return;
    onSave(parsed, notes.trim());
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[var(--ct1)] text-sm mb-1">
          Reps completed
          <span className="text-[var(--ct1)]/60 ml-1">(target: {s.targetReps})</span>
        </label>
        <input
          type="number"
          min={0}
          max={999}
          value={reps}
          onChange={e => setReps(e.target.value)}
          className="w-full bg-[var(--c5)] text-[var(--ct0)] rounded px-3 py-2 border border-[var(--c5)] focus:border-[var(--ca)] outline-none"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-[var(--ct1)] text-sm mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="How did it feel?"
          className="w-full bg-[var(--c5)] text-[var(--ct0)] rounded px-3 py-2 border border-[var(--c5)] focus:border-[var(--ca)] outline-none resize-none text-sm"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="complete" size="sm" onClick={handleSave}>Save</Button>
      </div>
    </div>
  );
}
