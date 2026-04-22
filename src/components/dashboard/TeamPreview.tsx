import { useAppState } from '@/hooks/useAppState';

export function TeamPreview() {
  const { settings } = useAppState();
  const teams = settings.teams ?? [];

  // Collect all approved members across all joined teams, deduped by id
  const seen = new Set<string>();
  const members = teams.flatMap(t => t.members.filter(m => m.role !== 'pending')).filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  if (teams.length === 0) return null;

  if (members.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-[var(--ct0)] text-sm font-semibold">Team Today</p>
        <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl px-4 py-6 text-center">
          <p className="text-[var(--ct2)] text-sm">No teammates yet.</p>
          <p className="text-[var(--ct2)] text-xs mt-1">Share your invite code to add people.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[var(--ct0)] text-sm font-semibold">Team Today</p>
        <span className="text-xs text-[var(--ct2)]">{members.length} member{members.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl overflow-hidden">
        {members.map((m, i) => {
          const initials = m.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
          const teamNames = teams.filter(t => t.members.some(tm => tm.id === m.id)).map(t => t.name).join(', ');
          return (
            <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${i < members.length - 1 ? 'border-b border-[var(--c4)]' : ''}`}>
              <span className="text-xs font-bold text-[var(--ct2)] w-4">#{i + 1}</span>
              <div className="w-8 h-8 rounded-full bg-[var(--c4)] flex items-center justify-center text-sm font-bold text-[var(--ct1)] shrink-0">
                {m.avatar ?? initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[var(--ct0)] text-xs font-semibold truncate">{m.displayName}</p>
                <p className="text-[var(--ct2)] text-[10px] truncate">{teamNames}</p>
              </div>
              {m.role === 'admin' && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#FACC15"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
