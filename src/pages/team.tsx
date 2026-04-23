import { useAppState } from '@/hooks/useAppState';
import { NavTabs } from '@/components/layout/NavTabs';
import type { Team, TeamMember } from '@/types';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';

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
  member, isAdmin, onApprove, onReject, onRemove, onMakeAdmin,
}: {
  member: TeamMember;
  isAdmin: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onRemove?: () => void;
  onMakeAdmin?: () => void;
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
      {isAdmin && member.role === 'member' && (
        <div className="flex items-center gap-1.5 shrink-0">
          {onMakeAdmin && (
            <button onClick={onMakeAdmin} className="px-2.5 py-1.5 rounded-lg bg-[#FACC15]/10 border border-[#FACC15]/30 text-[#FACC15] text-xs font-semibold hover:bg-[#FACC15]/20 transition-colors">
              Make Admin
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center text-[var(--ct2)] hover:text-[#EF4444] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
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
  const { data: session } = useSession();
  const [tab, setTab] = useState<'search' | 'code'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; code: string; admin_name?: string; organization?: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{ id: string; name: string; code: string; organization?: string } | null>(null);
  const [code, setCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  const displayName = (() => {
    try {
      const p = JSON.parse(localStorage.getItem('puh_profile') ?? 'null');
      if (!p) return '';
      const fullName = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
      return fullName || p.displayName || '';
    } catch { return ''; }
  })();

  const handleSearch = async (q: string) => {
    setQuery(q);
    setSelected(null);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('teams')
      .select('id, name, code, admin_name, organization')
      .or(`name.ilike.%${q.trim()}%,organization.ilike.%${q.trim()}%`)
      .limit(8);
    setResults(data ?? []);
    setSearching(false);
  };

  const handleJoin = async () => {
    const teamCode = tab === 'search' ? selected?.code ?? '' : code.trim().toUpperCase();
    const teamName = tab === 'search' ? selected?.name ?? `Team ${teamCode}` : `Team ${teamCode}`;
    const teamId   = tab === 'search' ? selected?.id  ?? ('team-' + Date.now()) : ('team-' + Date.now());
    const teamOrg  = tab === 'search' ? selected?.organization ?? null : null;
    if (!teamCode || teamCode.length < 4) { setError('Please select a team or enter a valid code.'); return; }

    // Update profile with the team they're joining
    const email = session?.user?.email ?? '';
    if (email) {
      await supabase.from('profiles').upsert({
        email,
        team:         teamName,
        organization: teamOrg,
      });
    }

    const newTeam: Team = {
      id: teamId,
      name: teamName,
      code: teamCode,
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--ct0)] text-lg font-bold">{joined ? 'Request sent! 🎉' : 'Join a team'}</p>
            <p className="text-[var(--ct2)] text-xs mt-0.5">{joined ? 'Waiting for admin approval' : 'Search by name or enter an invite code'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--c4)] flex items-center justify-center text-[var(--ct2)] hover:text-[var(--ct0)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {!joined ? (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--c2)] p-1 rounded-xl">
              {(['search', 'code'] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setError(''); }} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-[var(--c4)] text-[var(--ct0)]' : 'text-[var(--ct2)] hover:text-[var(--ct1)]'}`}>
                  {t === 'search' ? '🔍 Search' : '# Enter Code'}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              {tab === 'search' ? (
                <div>
                  <label className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide block mb-1.5">Team name</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search teams…"
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    className="w-full bg-[var(--c2)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border border-[var(--c5)] focus:border-[#22C55E] outline-none text-sm transition-colors"
                  />
                  {searching && <p className="text-[var(--ct2)] text-xs mt-2">Searching…</p>}
                  {results.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
                      {results.map(r => (
                        <button
                          key={r.id}
                          onClick={() => setSelected(r)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${selected?.id === r.id ? 'border-[#22C55E]/50 bg-[#22C55E]/10 text-[var(--ct0)]' : 'border-[var(--c5)] bg-[var(--c2)] text-[var(--ct1)] hover:border-[var(--ct2)]'}`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-semibold">{r.name}</span>
                            {r.organization && <span className="text-[var(--ct2)] text-xs px-1.5 py-0.5 rounded-md bg-[var(--c4)]">{r.organization}</span>}
                          </div>
                          {r.admin_name && <p className="text-[var(--ct2)] text-xs mt-0.5">Admin: {r.admin_name}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {query.length >= 2 && !searching && results.length === 0 && (
                    <p className="text-[var(--ct2)] text-xs mt-2">No teams found. Try a different name or use an invite code.</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide block mb-1.5">Invite code</label>
                  <input type="text" placeholder="e.g. X4K9MZ" value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }} maxLength={8} className="w-full bg-[var(--c2)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border border-[var(--c5)] focus:border-[#22C55E] outline-none text-sm tracking-widest font-bold uppercase transition-colors text-center" />
                </div>
              )}

              {error && <p className="text-[#EF4444] text-xs">{error}</p>}
            </div>

            <button
              onClick={handleJoin}
              disabled={tab === 'search' ? !selected : code.trim().length < 4}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#22C55E] text-[#0B1C2D] hover:bg-[#16A34A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Request to join
            </button>
          </>
        ) : (
          <>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl shrink-0">⏳</div>
              <div>
                <p className="text-amber-400 text-sm font-semibold">Request sent</p>
                <p className="text-[var(--ct2)] text-xs mt-0.5">Waiting for admin approval</p>
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
  const { data: session } = useSession();
  const [teamName, setTeamName] = useState('');
  const [organization, setOrganization] = useState('');
  const [orgSuggestions, setOrgSuggestions] = useState<string[]>([]);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [created, setCreated] = useState<Team | null>(null);
  const [copied, setCopied] = useState(false);

  // Pre-fill org from email domain on mount
  useEffect(() => {
    const email = session?.user?.email ?? '';
    if (email) {
      const domain = email.split('@')[1]?.split('.')[0] ?? '';
      if (domain) setOrganization(domain.charAt(0).toUpperCase() + domain.slice(1));
    }
  }, [session]);

  const handleOrgChange = async (val: string) => {
    setOrganization(val);
    if (!val.trim()) { setOrgSuggestions([]); setShowOrgDropdown(false); return; }
    const { data } = await supabase
      .from('teams')
      .select('organization')
      .ilike('organization', `%${val.trim()}%`)
      .not('organization', 'is', null)
      .limit(8);
    const unique = [...new Set((data ?? []).map((r: any) => r.organization as string).filter(Boolean))];
    setOrgSuggestions(unique);
    setShowOrgDropdown(unique.length > 0);
  };

  const handleCreate = async () => {
    if (!teamName.trim()) return;
    const profileName = (() => {
      try {
        const p = JSON.parse(localStorage.getItem('puh_profile') ?? 'null');
        if (!p) return 'Admin';
        const fullName = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
        return fullName || p.displayName || 'Admin';
      } catch { return 'Admin'; }
    })();
    const team: Team = {
      id: 'team-' + Date.now(),
      name: teamName.trim(),
      code: generateTeamCode(),
      isAdmin: true,
      members: [{ id: 'admin-' + Date.now(), displayName: profileName, role: 'admin', joinedAt: Date.now() }],
      joinedAt: Date.now(),
    };
    await supabase.from('teams').upsert({
      id: team.id,
      name: team.name,
      code: team.code,
      admin_name: profileName,
      organization: organization.trim() || null,
    });

    // Update the user's profile row with their team and org
    const email = session?.user?.email ?? '';
    if (email) {
      await supabase.from('profiles').upsert({
        email,
        team:         team.name,
        organization: organization.trim() || null,
      });
    }

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
            <div className="flex flex-col gap-3">
              {/* Team name */}
              <div>
                <label className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide block mb-1.5">Team name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Engineering, Sales Team…"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                  className="w-full bg-[var(--c2)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border border-[var(--c5)] focus:border-[#FACC15] outline-none text-sm transition-colors"
                />
              </div>

              {/* Organization with autocomplete */}
              <div className="relative">
                <label className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide block mb-1.5">
                  Organization <span className="text-[var(--ct2)] normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={organization}
                  onChange={e => handleOrgChange(e.target.value)}
                  onFocus={() => orgSuggestions.length > 0 && setShowOrgDropdown(true)}
                  onBlur={() => setTimeout(() => setShowOrgDropdown(false), 150)}
                  className="w-full bg-[var(--c2)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border border-[var(--c5)] focus:border-[#FACC15] outline-none text-sm transition-colors"
                />
                {showOrgDropdown && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-[var(--c1)] border border-[var(--c5)] rounded-xl overflow-hidden shadow-xl">
                    {orgSuggestions.map(org => (
                      <button
                        key={org}
                        onMouseDown={() => { setOrganization(org); setShowOrgDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[var(--ct0)] hover:bg-[var(--c4)] transition-colors flex items-center gap-2.5"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ct2)" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        {org}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[var(--ct2)] text-xs mt-1.5">Helps teammates find the right team when multiple orgs share a name.</p>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!teamName.trim()}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#FACC15] text-[#0B1C2D] hover:bg-[#EAB308] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create team
            </button>
          </>
        ) : (
          <>
            <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-4 text-center">
              <p className="text-[var(--ct2)] text-xs mb-2">Team invite code</p>
              <p className="text-[var(--ct0)] text-4xl font-black tracking-[0.2em] mb-3">{created.code}</p>
              <p className="text-[var(--ct2)] text-xs">for <span className="text-[var(--ct1)] font-semibold">{created.name}</span>
                {organization.trim() && <span> · {organization.trim()}</span>}
              </p>
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
  const [collapsed, setCollapsed] = useState(true);
  const [confirmTransfer, setConfirmTransfer] = useState<string | null>(null); // member id
  const [confirmLeave, setConfirmLeave] = useState(false);

  const adminMembers  = team.members.filter(m => m.role === 'admin');
  const activeMembers = team.members.filter(m => m.role === 'member');
  const pending       = team.members.filter(m => m.role === 'pending');
  const totalActive   = team.members.filter(m => m.role !== 'pending').length;

  // Next in line if admin leaves — earliest joinedAt among active members
  const nextInLine = [...activeMembers].sort((a, b) => a.joinedAt - b.joinedAt)[0] ?? null;

  function updateMembers(members: TeamMember[]) {
    onUpdate({ ...team, members });
  }

  async function transferAdmin(memberId: string) {
    const target = team.members.find(m => m.id === memberId);
    if (!target) return;
    const newMembers = team.members.map(m => {
      if (m.role === 'admin') return { ...m, role: 'member' as const };
      if (m.id === memberId) return { ...m, role: 'admin' as const };
      return m;
    });
    onUpdate({ ...team, members: newMembers, isAdmin: false });
    await supabase.from('teams').update({ admin_name: target.displayName }).eq('code', team.code);
    setConfirmTransfer(null);
  }

  async function handleLeave() {
    if (team.isAdmin && nextInLine) {
      // Auto-promote the next member before leaving
      await supabase.from('teams').update({ admin_name: nextInLine.displayName }).eq('code', team.code);
    }
    setConfirmLeave(false);
    onLeave();
  }

  async function shareCode() {
    const text = `Join my BreakRep team "${team.name}"! Use code ${team.code}.`;
    if (navigator.share) {
      try { await navigator.share({ title: `Join ${team.name} on BreakRep`, text }); return; } catch {}
    }
    navigator.clipboard.writeText(team.code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  const transferTarget = confirmTransfer ? team.members.find(m => m.id === confirmTransfer) : null;

  return (
    <>
    <div className="mb-4">
      {/* Team header */}
      <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-4 flex items-center justify-between mb-1">
        <button onClick={() => setCollapsed(c => !c)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`shrink-0 text-[var(--ct2)] transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
          <div className="min-w-0">
            <p className="text-[var(--ct0)] text-base font-bold truncate">{team.name}</p>
            <p className="text-[var(--ct2)] text-xs mt-0.5">
              {totalActive} member{totalActive !== 1 ? 's' : ''}
              {pending.length > 0 && <span className="text-amber-400"> · {pending.length} pending</span>}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {team.isAdmin && (
            <div className="flex items-center gap-1.5">
              <button onClick={shareCode} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-[var(--c4)] border-[var(--c5)] text-[var(--ct1)] text-xs font-semibold hover:border-[var(--ca)]/40 transition-all">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                <span className="text-[var(--ct2)] font-normal">Code:</span> {team.code}
              </button>
              <button onClick={() => navigator.clipboard.writeText(team.code).then(() => { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); })} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${codeCopied ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]' : 'bg-[var(--c4)] border-[var(--c5)] text-[var(--ct1)] hover:border-[var(--ca)]/40'}`}>
                {codeCopied ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                {codeCopied ? 'Copied!' : 'Copy code'}
              </button>
            </div>
          )}
          <button onClick={() => setConfirmLeave(true)} className="px-3 py-1.5 rounded-xl border border-[var(--c5)] text-xs font-semibold text-[var(--ct2)] hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors">Leave</button>
        </div>
      </div>

      {!collapsed && (
        <>
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
                <MemberCard
                  key={m.id} member={m} isAdmin={team.isAdmin}
                  onMakeAdmin={team.isAdmin ? () => setConfirmTransfer(m.id) : undefined}
                  onRemove={team.isAdmin ? () => updateMembers(team.members.filter(x => x.id !== m.id)) : undefined}
                />
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
        </>
      )}
    </div>

    {/* ── Confirm: transfer admin ── */}
    {confirmTransfer && transferTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className="w-full max-w-sm bg-[var(--c1)] border border-[var(--c5)] rounded-3xl p-6 flex flex-col gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FACC15]/10 flex items-center justify-center mx-auto">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FACC15" strokeWidth="2" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          <div className="text-center">
            <p className="text-[var(--ct0)] text-base font-bold">Transfer admin role?</p>
            <p className="text-[var(--ct2)] text-sm mt-1.5 leading-relaxed">
              <span className="text-[var(--ct0)] font-semibold">{transferTarget.displayName}</span> will become the new admin. You'll step down to a regular member and lose admin privileges.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirmTransfer(null)} className="flex-1 py-2.5 rounded-xl border border-[var(--c5)] text-sm font-semibold text-[var(--ct1)] hover:text-[var(--ct0)] transition-colors">Cancel</button>
            <button onClick={() => transferAdmin(confirmTransfer)} className="flex-1 py-2.5 rounded-xl bg-[#FACC15] text-[#0B1C2D] text-sm font-bold hover:bg-[#EAB308] transition-colors">Yes, transfer</button>
          </div>
        </div>
      </div>
    )}

    {/* ── Confirm: leave team ── */}
    {confirmLeave && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className="w-full max-w-sm bg-[var(--c1)] border border-[var(--c5)] rounded-3xl p-6 flex flex-col gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/10 flex items-center justify-center mx-auto">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          </div>
          <div className="text-center">
            <p className="text-[var(--ct0)] text-base font-bold">Leave {team.name}?</p>
            {team.isAdmin && nextInLine ? (
              <p className="text-[var(--ct2)] text-sm mt-1.5 leading-relaxed">
                As admin, leaving will automatically pass the role to <span className="text-[var(--ct0)] font-semibold">{nextInLine.displayName}</span>, the next longest-standing member.
              </p>
            ) : team.isAdmin && !nextInLine ? (
              <p className="text-[var(--ct2)] text-sm mt-1.5 leading-relaxed">
                You're the only member. Leaving will disband the team.
              </p>
            ) : (
              <p className="text-[var(--ct2)] text-sm mt-1.5">You'll be removed from this team.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirmLeave(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--c5)] text-sm font-semibold text-[var(--ct1)] hover:text-[var(--ct0)] transition-colors">Cancel</button>
            <button onClick={handleLeave} className="flex-1 py-2.5 rounded-xl bg-[#EF4444] text-white text-sm font-bold hover:bg-[#DC2626] transition-colors">Leave</button>
          </div>
        </div>
      </div>
    )}
    </>
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
          <>
            {teams.map(team => (
              <TeamCard key={team.id} team={team} onUpdate={updateTeam} onLeave={() => leaveTeam(team.id)} />
            ))}
            {/* Always-visible create / join buttons below the team list */}
            <div className="flex gap-2 mt-2 mb-4">
              <button
                onClick={() => setShowCreate(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-[var(--c5)] text-[var(--ct2)] text-sm font-semibold hover:border-[#FACC15]/50 hover:text-[#FACC15] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create team
              </button>
              <button
                onClick={() => setShowJoin(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-[var(--c5)] text-[var(--ct2)] text-sm font-semibold hover:border-[#22C55E]/50 hover:text-[#22C55E] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                Join team
              </button>
            </div>
          </>
        )}
      </main>

      {showJoin && <JoinTeamSheet onClose={() => setShowJoin(false)} onJoined={team => { addTeam(team); setShowJoin(false); }} />}
      {showCreate && <CreateTeamSheet onClose={() => setShowCreate(false)} onCreated={team => { addTeam(team); setShowCreate(false); }} />}

      <NavTabs />
    </div>
  );
}
