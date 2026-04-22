import { useState, useEffect } from 'react';
import type { SessionLog } from '@/types';

/**
 * Returns a formatted countdown string to the next pending session.
 */
export function useCountdown(sessions: SessionLog[]): string {
  const [display, setDisplay] = useState('—');

  useEffect(() => {
    const nextPending = sessions
      .filter(s => s.status === 'pending' || s.status === 'snoozed')
      .map(s => {
        const d = new Date(s.date);
        if (s.status === 'snoozed' && s.snoozedUntil) {
          return new Date(s.snoozedUntil).getTime();
        }
        d.setHours(s.scheduledHour, s.scheduledMinute ?? 0, 0, 0);
        return d.getTime();
      })
      .filter(t => t > Date.now())
      .sort((a, b) => a - b)[0];

    if (!nextPending) {
      setDisplay('Done for today');
      return;
    }

    const tick = () => {
      const diff = nextPending - Date.now();
      if (diff <= 0) { setDisplay('Now'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setDisplay(
        h > 0
          ? `${h}h ${String(m).padStart(2, '0')}m`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [sessions]);

  return display;
}
