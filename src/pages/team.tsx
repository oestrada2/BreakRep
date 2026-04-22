import { useAppState } from '@/hooks/useAppState';
import { NavTabs } from '@/components/layout/NavTabs';
import type { Team, TeamMember } from '@/types';
import { useState } from 'react';
import { useRouter } from 'next/router';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function generateTeamCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function RoleBadge({ role }: { role: 'admin' | 'member' | 'pending' }) {
  if (role === 'admin') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FACC15]/15 border border-[#FACC15]/30 text-[#FACC15] text-[10px] font-bold uppercase tracking-wide">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      Admin
    </span>
  );
  if (role === 'pending') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wide">
      Pending
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct2)] text-[10px] font-semibold uppercase tracking-wide">
      Member
    </span>
  );
}

function MemberCard({
  member, isAdmin, onApprove, onReject, onRemove,
}: {
  member: TeamMember;
  isAdmin: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onRemove?: () => void;
}) {
  const initials = member.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 border-b border-[var(--c4)] last:border-0 ${member.role === 'pending' ? 'bg-amber-500/5' : ''}`}>
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold text-sm ${
        member.role === 'admin'
          ? 'bg-gradient-to-br from-[#FACC15] to-[#F59E0B] text-[#0B1C2D]'
          : member.role === 'pending'
          ? 'bg-amber-500/20 text-amber-300'
          : 'bg-[var(--c4)] text-[var(--ct1)]'
      }`}>
        {member.avatar ?? initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[var(--ct0)] text-sm font-semibold truncate">{member.displayName}</p>
          <RoleBadge role={member.role} />
        </div>
        <p className="text-[var(--ct2)] text-xs mt-0.5">
          {member.role === 'pending' ? 'Requested to join' : `Joined ${formatDate(member.joinedAt)}`}
        </p>
      </div>
      {isAdmin && member.role === 'pending' && (
        <div className="flex gap-1.5 shrink-0">
          <button onClick={onApprove} className="px-2.5 py-1.5 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-xs font-semibold hover:bg-[#22C55E]/25 transition-colors">Approve</button>
          <button onClick={onReject} className="px-2.5 py-1.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/20 transition-colors">Reject</button>
        </div>
      )}
      {isAdmin && member.role === 'member' && onRemove && (
        <button onClick={onRemove} className="shrink-0 w-7 h-7 flex items-center justify-center text-[var(--ct2)] hover:text-[#EF4444] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </div>
  );
}

function SectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-2 mt-4 first:mt-0">
      <p className="text-[var(--ct2)] text-xs font-bold uppercase tracking-widest">{title}</p>
      {count !== undefined && (
        <span className="px-1.5 py-0.5 rounded-full bg-[var(--c4)] text-[var(--ct2)] text-[10px] font-bold">{count}</span>
      )}
    </div>
  );
}

// ── Join sheet ────────────────────────────────────────────────────────────────
function JoinTeamSheet({ onClose, onJoined }: { onClose: () => void; onJoined: (team: Team) => void }) {
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { setError('Please enter a valid invite code.'); return; }
    if (!displayName.trim()) { setError('Please enter your display name.'); return; }
    const newTeam: Team = {
      id: 'team-' + Date.now(),
      name: `Team ${trimmed}`,
      code: trimmed,
      isAdmin: false,
      members: [{ id: 'member-' + Date.now(), displayName: displayName.trim(), role: 'pending', joinedAt: Date.now() }],
      joinedAt: Date.now(),
    };
    setError('');
    setJoined(true);
    onJoined(newTeam);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm bg-[var(--c1)] border border-[var(--c5)] rounded-3xl p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--ct0)] text-lg font-bold">{joined ? "Request sent! 🎉" : 'Join a team'}</p>
            <p className="text-[var(--ct2)] text-xs mt-0.5">{joined ? "Waiting for admin approval" : 'Enter the invite code shared by your team'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--c4)] flex items-center justify-center text-[var(--ct2)] hover:text-[var(--ct0)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {!joined ? (
          <>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide block mb-1.5">Your display name</label>
                <input type="text" autoFocus placeholder="e.g. Alex Rivera" value={displayName} onChange={e => { setDisplayName(e.target.value); setError(''); }} className="w-full bg-[var(--c2)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border border-[var(--c5)] focus:border-[#22C55E] outline-none text-sm transition-colors" />
              </div>
              <div>
                <label className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide block mb-1.5">Invite code</label>
                <input type="text" placeholder="e.g. X4K9MZ" value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }} maxLength={8} className="w-full bg-[var(--c2)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border border-[var(--c5)] focus:border-[#22C55E] outline-none text-sm tracking-widest font-bold uppercase transition-colors text-center" />
              </div>
              {error && <p className="text-[#EF4444] text-xs">{error}</p>}
            </div>
            <button onClick={handleJoin} disabled={!code.trim() || !displayName.trim()} className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#22C55E] text-[#0B1C2D] hover:bg-[#16A34A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Request to join</button>
          </>
        ) : (
          <>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl shrink-0">⏳</div>
              <div>
                <p className="text-amber-400 text-sm font-semibold">Request sent</p>
                <p className="text-[var(--ct2)] text-xs mt-0.5">Waiting for admin approval for code <span className="font-bold tracking-widest text-[var(--ct1)]">{code.trim().toUpperCase()}</span></p>
              </div>
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-semibold text-[var(--ct1)] hover:text-[var(--ct0)] transition-colors">Done</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Create sheet ──────────────────────────────────────────────────────────────
function CreateTeamSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (team: Team) => void }) {
  const [teamName, setTeamName] = useState('');
  const [created, setCreated] = useState<Team | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    if (!teamName.trim()) return;
    const team: Team = {
      id: 'team-' + Date.now(),
      name: teamName.trim(),
      code: generateTeamCode(),
      isAdmin: true,
      members: [{ id: 'admin-' + Date.now(), displayName: 'You', role: 'admin', joinedAt: Date.now() }],
      joinedAt: Date.now(),
    };
    setCreated(team);
    onCreated(team);
  };

  const handleCopy = () => {
    if (!created) return;
    navigator.clipboard.writeText(created.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm bg-[var(--c1)] border border-[var(--c5)] rounded-3xl p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--ct0)] text-lg font-bold">{created ? 'Team created! 🎉' : 'Create a team'}</p>
            <p className="text-[var(--ct2)] text-xs mt-0.5">{created ? 'Share the code with your crew' : 'Give your team a name to get started'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--c4)] flex items-center justify-center text-[var(--ct2)] hover:text-[var(--ct0)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {!created ? (
          <>
            <div>
              <label className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide block mb-1.5">Team name</label>
              <input type="text" autoFocus placeholder="e.g. Engineering, Sales Team…" value={teamName} onChange={e => setTeamName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} className="w-full bg-[var(--c2)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border border-[var(--c5)] focus:border-[#FACC15] outline-none text-sm transition-colors" />
            </div>
            <button onClick={handleCreate} disabled={!teamName.trim()} className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#FACC15] text-[#0B1C2D] hover:bg-[#EAB308] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Create team</button>
          </>
        ) : (
          <>
            <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-4 text-center">
              <p className="text-[var(--ct2)] text-xs mb-2">Team invite code</p>
              <p className="text-[var(--ct0)] text-4xl font-black tracking-[0.2em] mb-3">{created.code}</p>
              <p className="text-[var(--ct2)] text-xs">for <span className="text-[var(--ct1)] font-semibold">{created.name}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleCopy} className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${copied ? 'bg-[#22C55E]/10 border-[#22C55E]/40 text-[#22C55E]' : 'bg-[var(--c2)] border-[var(--c5)] text-[var(--ct1)] hover:border-[var(--ct2)]'}`}>
                {copied ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                {copied ? 'Copied!' : 'Copy code'}
              </button>
              <a href={`sms:?body=${encodeURIComponent(`Join my BreakRep team "${created.name}"! Use code ${created.code}.`)}`} className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[var(--c5)] bg-[var(--c2)] text-[var(--ct1)] text-sm font-semibold hover:border-[var(--ct2)] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Text
              </a>
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-semibold text-[var(--ct1)] hover:text-[var(--ct0)] transition-colors">Done</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Team card ─────────────────────────────────────────────────────────────────
function TeamCard({ team, onUpdate, onLeave }: { team: Team; onUpdate: (updated: Team) => void; onLeave: () => void }) {
  const [codeCopied, setCodeCopied] = useState(false);

  const adminMembers  = team.members.filter(m => m.role === 'admin');
  const activeMembers = team.members.filter(m => m.role === 'member');
  const pending       = team.members.filter(m => m.role === 'pending');
  const totalActive   = team.members.filter(m => m.role !== 'pending').length;

  function updateMembers(members: TeamMember[]) {
    onUpdate({ ...team, members });
  }

  async function shareCode() {
    const text = `Join my BreakRep team "${team.name}"! Use code ${team.code}.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${team.name} on BreakRep`, text });
        return;
      } catch {}
    }
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(team.code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  return (
    <div className="mb-6">
      {/* Team header */}
      <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-4 flex items-center justify-between mb-1">
        <div>
          <p className="text-[var(--ct0)] text-base font-bold">{team.name}</p>
          <p className="text-[var(--ct2)] text-xs mt-0.5">
            {totalActive} member{totalActive !== 1 ? 's' : ''}
            {pending.length > 0 && <span className="text-amber-400"> · {pending.length} pending</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {team.isAdmin && (
            <div className="flex items-center gap-1.5">
              {/* Share */}
              <button onClick={shareCode} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-[var(--c4)] border-[var(--c5)] text-[var(--ct1)] text-xs font-semibold hover:border-[var(--ca)]/40 transition-all">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                {team.code}
              </button>
              {/* Copy */}
              <button onClick={() => navigator.clipboard.writeText(team.code).then(() => { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); })} className={`w-7 h-7 flex items-center justify-center rounded-xl border text-xs transition-all ${codeCopied ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]' : 'bg-[var(--c4)] border-[var(--c5)] text-[var(--ct1)] hover:border-[var(--ca)]/40'}`}>
                {codeCopied
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                }
              </button>
            </div>
          )}
          <button onClick={onLeave} className="px-3 py-1.5 rounded-xl border border-[var(--c5)] text-xs font-semibold text-[var(--ct2)] hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors">Leave</button>
        </div>
      </div>

      {/* Admin pending alert */}
      {team.isAdmin && pending.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl px-4 py-3 flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p className="text-amber-300 text-sm flex-1">
            <span className="font-semibold">{pending.length} request{pending.length !== 1 ? 's' : ''}</span> waiting for your approval
          </p>
        </div>
      )}

      {/* Admins */}
      <SectionLabel title="Admin" />
      <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl overflow-hidden mb-1">
        {adminMembers.length > 0 ? adminMembers.map(m => <MemberCard key={m.id} member={m} isAdmin={false} />) : <p className="px-4 py-3.5 text-[var(--ct2)] text-sm italic">No admin found.</p>}
      </div>

      {/* Members */}
      <SectionLabel title="Members" count={activeMembers.length} />
      <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl overflow-hidden mb-1">
        {activeMembers.length > 0 ? (
          activeMembers.map(m => (
            <MemberCard key={m.id} member={m} isAdmin={team.isAdmin} onRemove={team.isAdmin ? () => updateMembers(team.members.filter(x => x.id !== m.id)) : undefined} />
          ))
        ) : (
          <div className="px-4 py-5 text-center">
            <p className="text-[var(--ct2)] text-sm">No members yet.</p>
            {team.isAdmin && <p className="text-[var(--ct2)] text-xs mt-1">Share code <span className="text-[#FACC15] font-bold tracking-widest">{team.code}</span> to invite people.</p>}
          </div>
        )}
      </div>

      {/* Pending (admin only) */}
      {team.isAdmin && (
        <>
          <SectionLabel title="Pending Requests" count={pending.length} />
          <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl overflow-hidden">
            {pending.length > 0 ? pending.map(m => (
              <MemberCard
                key={m.id} member={m} isAdmin
                onApprove={() => updateMembers(team.members.map(x => x.id === m.id ? { ...x, role: 'member' as const } : x))}
                onReject={() => updateMembers(team.members.filter(x => x.id !== m.id))}
              />
            )) : (
              <p className="px-4 py-5 text-center text-[var(--ct2)] text-sm">No pending requests.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const router = useRouter();
  const { settings, updateSettings } = useAppState();
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const teams = settings.teams ?? [];

  function updateTeam(updated: Team) {
    updateSettings({ teams: teams.map(t => t.id === updated.id ? updated : t) });
  }

  function leaveTeam(id: string) {
    updateSettings({ teams: teams.filter(t => t.id !== id) });
  }

  function addTeam(team: Team) {
    updateSettings({ teams: [...teams, team] });
  }

  return (
    <div className="min-h-screen bg-[var(--c0)] text-[var(--ct0)] font-sans pb-20">
      <header className="sticky top-0 z-50 bg-[var(--c0)]/95 backdrop-blur border-b border-[var(--c2)] px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--ct0)] text-xl font-bold">Teams</h1>
            <p className="text-[var(--ct2)] text-xs mt-0.5">{teams.length > 0 ? `${teams.length} team${teams.length !== 1 ? 's' : ''}` : 'No teams yet'}</p>
          </div>
          {teams.length > 0 && (
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 rounded-xl bg-[var(--c2)] border border-[var(--c5)] text-[var(--ct1)] text-xs font-semibold hover:border-[var(--ca)]/40 transition-colors">+ Create</button>
              <button onClick={() => setShowJoin(true)} className="px-3 py-1.5 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] text-xs font-semibold hover:bg-[#22C55E]/20 transition-colors">+ Join</button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4">
        {teams.length === 0 ? (
          <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--c4)] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ct2)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="text-[var(--ct0)] text-base font-semibold mb-1">No teams yet</p>
            <p className="text-[var(--ct2)] text-sm mb-5">Create a team or join one with an invite code.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 rounded-xl bg-[#FACC15] text-[#0B1C2D] text-sm font-bold hover:bg-[#F59E0B] transition-colors">Create team</button>
              <button onClick={() => setShowJoin(true)} className="px-5 py-2.5 rounded-xl bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct1)] text-sm font-semibold hover:text-[var(--ct0)] transition-colors">Join team</button>
            </div>
          </div>
        ) : (
          teams.map(team => (
            <TeamCard key={team.id} team={team} onUpdate={updateTeam} onLeave={() => leaveTeam(team.id)} />
          ))
        )}
      </main>

      {showJoin && <JoinTeamSheet onClose={() => setShowJoin(false)} onJoined={team => { addTeam(team); setShowJoin(false); }} />}
      {showCreate && <CreateTeamSheet onClose={() => setShowCreate(false)} onCreated={team => { addTeam(team); setShowCreate(false); }} />}

      <NavTabs />
    </div>
  );
}
