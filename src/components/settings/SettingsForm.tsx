import type { AppSettings, AlertStyle, ScheduleMode, ExperienceLevel, EnabledExercises, Team, NotificationSound } from '@/types';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { NotificationService, NOTIFICATION_SOUNDS } from '@/lib/notifications';
import { useTheme, THEMES } from '@/contexts/ThemeContext';

interface SettingsFormProps {
  settings: AppSettings;
  onChange: (partial: Partial<AppSettings>) => void;
  onReset: () => void;
  onTestNotification: () => void;
}

// ── Primitive components ────────────────────────────────────────────────────

function AccordionSection({
  icon, title, subtitle, children, defaultOpen = false,
}: {
  icon: React.ReactNode; title: string; subtitle?: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors hover:bg-[var(--c3)]/40 ${open ? 'border-b border-[var(--c4)]' : ''}`}
      >
        <div className="w-8 h-8 rounded-xl bg-[var(--c4)] flex items-center justify-center shrink-0 text-[var(--ct1)]">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[var(--ct0)] text-sm font-semibold">{title}</p>
          {subtitle && <p className="text-[var(--ct2)] text-xs mt-0.5">{subtitle}</p>}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="var(--ct2)" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function Row({
  label, sublabel, children, last,
}: {
  label: string; sublabel?: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 gap-4 ${!last ? 'border-b border-[var(--c4)]' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[var(--ct0)] text-sm">{label}</p>
        {sublabel && <p className="text-[var(--ct2)] text-xs mt-0.5">{sublabel}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-[#FACC15]' : 'bg-[var(--c5)]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center bg-[var(--c4)] border border-[var(--c5)] rounded-xl overflow-hidden">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 h-9 flex items-center justify-center text-[var(--ct2)] hover:text-[var(--ct0)] text-lg font-semibold transition-colors"
      >−</button>
      <span className="w-10 text-center text-[var(--ct0)] text-sm font-bold tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-9 h-9 flex items-center justify-center text-[var(--ct2)] hover:text-[var(--ct0)] text-lg font-semibold transition-colors"
      >+</button>
    </div>
  );
}

function SegmentControl<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-[var(--c4)] border border-[var(--c5)] rounded-xl p-0.5 gap-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            value === opt.value ? 'bg-[#FACC15] text-[#0B1C2D]' : 'text-[var(--ct2)] hover:text-[var(--ct1)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function NavRow({ label, sublabel, onPress, tint }: { label: string; sublabel?: string; onPress: () => void; tint?: string }) {
  return (
    <button
      onClick={onPress}
      className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[var(--c4)] last:border-0 hover:bg-[var(--c4)]/50 transition-colors text-left"
    >
      <div>
        <p className="text-sm" style={{ color: tint ?? 'var(--ct0)' }}>{label}</p>
        {sublabel && <p className="text-[var(--ct2)] text-xs mt-0.5">{sublabel}</p>}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tint ?? 'var(--ct2)'} strokeWidth="2.5" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}

// ── Profile (persisted to its own localStorage key) ─────────────────────────

interface Profile {
  displayName: string;
  email: string;
  team: string;
  username: string;
  avatarUrl?: string;
}
const DEFAULT_PROFILE: Profile = {
  displayName: 'Your Name',
  email: 'you@company.com',
  team: 'Engineering',
  username: '',
  avatarUrl: '',
};
function loadProfile(): Profile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try { return JSON.parse(localStorage.getItem('puh_profile') ?? 'null') ?? DEFAULT_PROFILE; }
  catch { return DEFAULT_PROFILE; }
}

// ── Main component ──────────────────────────────────────────────────────────

export function SettingsForm({ settings, onChange, onReset, onTestNotification }: SettingsFormProps) {
  const { progression: p, reminders: r } = settings;
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();

  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [editingProfile, setEditingProfile] = useState(false);
  const [draft, setDraft] = useState<Profile>(DEFAULT_PROFILE);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showMissed, setShowMissed] = useState(false);
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [codeCopied, setCodeCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [customExInput, setCustomExInput] = useState('');
  const [customExTrackingType, setCustomExTrackingType] = useState<'reps' | 'time'>('reps');

  useEffect(() => {
    const saved = loadProfile();
    const googleImage = (session?.user as any)?.image ?? '';
    const googleEmail = (session?.user as any)?.email ?? '';
    const merged: Profile = {
      ...saved,
      avatarUrl: saved.avatarUrl || googleImage,
      email: saved.email && saved.email !== DEFAULT_PROFILE.email ? saved.email : (googleEmail || saved.email),
    };
    if (merged.avatarUrl !== saved.avatarUrl || merged.email !== saved.email) {
      localStorage.setItem('puh_profile', JSON.stringify(merged));
    }
    setProfile(merged);
    setDraft(merged);
  }, [session]);

  function saveProfile() {
    setProfile(draft);
    localStorage.setItem('puh_profile', JSON.stringify(draft));
    setEditingProfile(false);
  }

  const initials = profile.displayName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const teams: Team[] = settings.teams ?? [];

  return (
    <div className="space-y-3 pb-6">

      {/* ── 1. Profile ──────────────────────────────────────────────────────── */}
      <AccordionSection
        defaultOpen
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        }
        title="Profile"
        subtitle="Your identity in BreakRep"
      >
        {!editingProfile ? (
          <div className="px-4 py-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl shrink-0 overflow-hidden bg-gradient-to-br from-[var(--ca)] to-[#1D4ED8] flex items-center justify-center">
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                : <span className="text-white text-lg font-bold">{initials}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[var(--ct0)] text-base font-semibold truncate">{profile.displayName}</p>
              <p className="text-[var(--ct2)] text-xs mt-0.5 truncate">{profile.email}</p>
              {profile.team && (
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct1)] text-xs">
                  {profile.team}
                </span>
              )}
            </div>
            <button
              onClick={() => { setDraft(profile); setEditingProfile(true); }}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct1)] text-xs font-semibold hover:border-[var(--ca)]/40 hover:text-[var(--ct0)] transition-colors"
            >Edit</button>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            {/* Avatar preview + photo picker */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl shrink-0 overflow-hidden bg-gradient-to-br from-[var(--ca)] to-[#1D4ED8] flex items-center justify-center">
                {draft.avatarUrl
                  ? <img src={draft.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  : <span className="text-white text-lg font-bold">{initials}</span>
                }
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  id="avatar-file-input"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setDraft(d => ({ ...d, avatarUrl: ev.target?.result as string }));
                    reader.readAsDataURL(file);
                  }}
                />
                <button
                  onClick={() => document.getElementById('avatar-file-input')?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[var(--c5)] text-[var(--ct1)] text-xs font-semibold hover:border-[#FACC15]/50 hover:text-[var(--ct0)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                  </svg>
                  Choose from gallery
                </button>
                {(session?.user as any)?.image && (() => {
                  const googlePhoto = (session!.user as any).image as string;
                  return (
                    <button
                      onClick={() => setDraft(d => ({ ...d, avatarUrl: googlePhoto }))}
                      className="mt-1.5 w-full text-center text-[10px] text-[var(--ct2)] hover:text-[var(--ca)] transition-colors"
                    >Reset to Google photo</button>
                  );
                })()}
              </div>
            </div>
            <div>
              <label className="text-[var(--ct2)] text-xs block mb-1">Display name</label>
              <input
                value={draft.displayName}
                onChange={e => setDraft(d => ({ ...d, displayName: e.target.value }))}
                className="w-full bg-[var(--c4)] border border-[var(--c5)] rounded-xl px-3 py-2 text-sm text-[var(--ct0)] focus:border-[#FACC15]/50 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[var(--ct2)] text-xs block mb-1">Email</label>
              <input
                type="email"
                value={draft.email}
                onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                className="w-full bg-[var(--c4)] border border-[var(--c5)] rounded-xl px-3 py-2 text-sm text-[var(--ct0)] focus:border-[#FACC15]/50 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[var(--ct2)] text-xs block mb-1">Team / Department</label>
              <input
                value={draft.team}
                onChange={e => setDraft(d => ({ ...d, team: e.target.value }))}
                className="w-full bg-[var(--c4)] border border-[var(--c5)] rounded-xl px-3 py-2 text-sm text-[var(--ct0)] focus:border-[#FACC15]/50 outline-none transition-colors"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveProfile}
                className="flex-1 py-2 rounded-xl bg-[#FACC15] text-[#0B1C2D] text-sm font-bold hover:bg-[#F59E0B] transition-colors"
              >Save changes</button>
              <button
                onClick={() => setEditingProfile(false)}
                className="px-4 py-2 rounded-xl bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct1)] text-sm font-semibold hover:text-[var(--ct0)] transition-colors"
              >Cancel</button>
            </div>
          </div>
        )}
      </AccordionSection>

      {/* ── 2. Movement Plan ────────────────────────────────────────────────── */}
      <AccordionSection
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/>
          </svg>
        }
        title="Movement Plan"
        subtitle="Exercise and progression settings"
      >
        {/* Experience level */}
        <div className="px-4 py-3.5 border-b border-[var(--c4)]">
          <p className="text-[var(--ct0)] text-sm mb-0.5">Experience level</p>
          <p className="text-[var(--ct2)] text-xs mb-3">Adjusts default rep targets and pacing</p>
          <SegmentControl<ExperienceLevel>
            options={[
              { value: 'beginner',     label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced',     label: 'Advanced' },
            ]}
            value={settings.experienceLevel}
            onChange={v => onChange({ experienceLevel: v })}
          />
        </div>

        {/* Exercises */}
        <div className="px-4 py-3.5 border-b border-[var(--c4)]">
          <p className="text-[var(--ct0)] text-sm mb-0.5">Exercises</p>
          <p className="text-[var(--ct2)] text-xs mb-3">Choose which exercises appear in your sessions</p>
          <div className="space-y-2">
            {([
              { key: 'pushups', label: 'Push-ups', emoji: '💪' },
              { key: 'squats',  label: 'Squats',   emoji: '🦵' },
              { key: 'situps',  label: 'Plank',    emoji: '⏱️' },
            ] as { key: string; label: string; emoji: string }[]).map(ex => {
              const enabledEx = settings.enabledExercises ?? { pushups: true, squats: true, situps: true };
              const enabledCount = Object.values(enabledEx).filter(Boolean).length;
              const enabled = enabledEx[ex.key] ?? false;
              return (
                <button
                  key={ex.key}
                  onClick={() => {
                    if (enabled && enabledCount === 1) return;
                    onChange({ enabledExercises: { ...enabledEx, [ex.key]: !enabled } });
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                    enabled ? 'bg-[var(--c4)] border-[#FACC15]/40' : 'bg-[var(--c2)] border-[var(--c5)] opacity-50'
                  }`}
                >
                  <span className="text-lg">{ex.emoji}</span>
                  <span className="flex-1 text-sm text-[var(--ct0)] text-left">{ex.label}</span>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    enabled ? 'bg-[#FACC15] border-[#FACC15]' : 'border-[var(--ct2)]'
                  }`}>
                    {enabled && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#0B1C2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Custom exercises */}
            {Object.entries(settings.customExerciseLabels ?? {}).map(([key, label]) => {
              const enabledEx = settings.enabledExercises ?? { pushups: true, squats: true, situps: true };
              const enabledCount = Object.values(enabledEx).filter(Boolean).length;
              const enabled = enabledEx[key] ?? true;
              const trackingType = settings.customExerciseTrackingTypes?.[key] ?? 'reps';
              return (
                <div
                  key={key}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                    enabled ? 'bg-[var(--c4)] border-[#FACC15]/40' : 'bg-[var(--c2)] border-[var(--c5)] opacity-50'
                  }`}
                >
                  <button
                    onClick={() => {
                      if (enabled && enabledCount === 1) return;
                      onChange({ enabledExercises: { ...enabledEx, [key]: !enabled } });
                    }}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <span className="text-lg">{trackingType === 'time' ? '⏱️' : '🏋️'}</span>
                    <span className="flex-1 text-sm text-[var(--ct0)] truncate">{label}</span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Reps / Time toggle */}
                    <div className="flex rounded-lg border border-[var(--c5)] overflow-hidden text-[10px] font-semibold">
                      <button type="button"
                        onClick={() => onChange({ customExerciseTrackingTypes: { ...(settings.customExerciseTrackingTypes ?? {}), [key]: 'reps' } })}
                        className={`px-2 py-1 transition-colors ${trackingType === 'reps' ? 'bg-[var(--ca)] text-white' : 'text-[var(--ct2)]'}`}>
                        Reps
                      </button>
                      <button type="button"
                        onClick={() => onChange({ customExerciseTrackingTypes: { ...(settings.customExerciseTrackingTypes ?? {}), [key]: 'time' } })}
                        className={`px-2 py-1 transition-colors ${trackingType === 'time' ? 'bg-[var(--ca)] text-white' : 'text-[var(--ct2)]'}`}>
                        Time
                      </button>
                    </div>
                    <div
                      onClick={() => {
                        if (enabled && enabledCount === 1) return;
                        onChange({ enabledExercises: { ...enabledEx, [key]: !enabled } });
                      }}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${
                        enabled ? 'bg-[#FACC15] border-[#FACC15]' : 'border-[var(--ct2)]'
                      }`}
                    >
                      {enabled && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#0B1C2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const nextLabels = { ...(settings.customExerciseLabels ?? {}) };
                        delete nextLabels[key];
                        const nextEnabled = { ...enabledEx };
                        delete nextEnabled[key];
                        const nextTypes = { ...(settings.customExerciseTrackingTypes ?? {}) };
                        delete nextTypes[key];
                        onChange({ customExerciseLabels: nextLabels, enabledExercises: nextEnabled, customExerciseTrackingTypes: nextTypes });
                      }}
                      className="w-5 h-5 flex items-center justify-center text-[var(--ct2)] hover:text-red-400 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add custom exercise */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={customExInput}
                onChange={e => setCustomExInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customExInput.trim()) {
                    const key = `custom_${Date.now()}`;
                    onChange({
                      customExerciseLabels: { ...(settings.customExerciseLabels ?? {}), [key]: customExInput.trim() },
                      enabledExercises: { ...(settings.enabledExercises ?? { pushups: true, squats: true, situps: true }), [key]: true },
                      customExerciseTrackingTypes: { ...(settings.customExerciseTrackingTypes ?? {}), [key]: customExTrackingType },
                    });
                    setCustomExInput('');
                    setCustomExTrackingType('reps');
                  }
                }}
                placeholder="Add your own exercise…"
                className="flex-1 bg-[var(--c2)] border border-[var(--c5)] rounded-xl px-3 py-2 text-sm text-[var(--ct0)] placeholder-[var(--ct2)] focus:outline-none focus:border-[var(--ca)] transition-colors"
              />
              <div className="flex shrink-0 rounded-xl border border-[var(--c5)] overflow-hidden text-xs font-semibold">
                <button type="button" onClick={() => setCustomExTrackingType('reps')}
                  className={`px-2.5 py-2 transition-colors ${customExTrackingType === 'reps' ? 'bg-[var(--ca)] text-white' : 'text-[var(--ct2)]'}`}>
                  Reps
                </button>
                <button type="button" onClick={() => setCustomExTrackingType('time')}
                  className={`px-2.5 py-2 transition-colors ${customExTrackingType === 'time' ? 'bg-[var(--ca)] text-white' : 'text-[var(--ct2)]'}`}>
                  Time
                </button>
              </div>
              <button
                onClick={() => {
                  if (!customExInput.trim()) return;
                  const key = `custom_${Date.now()}`;
                  onChange({
                    customExerciseLabels: { ...(settings.customExerciseLabels ?? {}), [key]: customExInput.trim() },
                    enabledExercises: { ...(settings.enabledExercises ?? { pushups: true, squats: true, situps: true }), [key]: true },
                    customExerciseTrackingTypes: { ...(settings.customExerciseTrackingTypes ?? {}), [key]: customExTrackingType },
                  });
                  setCustomExInput('');
                  setCustomExTrackingType('reps');
                }}
                disabled={!customExInput.trim()}
                className="w-9 h-9 shrink-0 rounded-xl bg-[var(--ca)] flex items-center justify-center transition-opacity disabled:opacity-30"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>
        </div>

        <Row label="Starting reps" sublabel="Reps per session when you begin">
          <Stepper value={p.startingReps} min={1} max={100}
            onChange={v => onChange({ progression: { ...p, startingReps: v } })} />
        </Row>

        <Row label="Max reps cap" sublabel="Progression stops here">
          <Stepper value={p.maxReps} min={10} max={200}
            onChange={v => onChange({ progression: { ...p, maxReps: v } })} />
        </Row>

        <div className="px-4 py-3.5">
          <p className="text-[var(--ct0)] text-sm mb-0.5">Rep progression</p>
          <p className="text-[var(--ct2)] text-xs mb-3">Automatically increase difficulty over time</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[var(--ct2)] text-xs">Add</span>
            <Stepper value={p.increaseAmount} min={1} max={20}
              onChange={v => onChange({ progression: { ...p, increaseAmount: v } })} />
            <span className="text-[var(--ct2)] text-xs">reps every</span>
            <Stepper value={p.increaseEveryDays} min={1} max={30}
              onChange={v => onChange({ progression: { ...p, increaseEveryDays: v } })} />
            <span className="text-[var(--ct2)] text-xs">days</span>
          </div>
        </div>
      </AccordionSection>

      {/* ── 3. Reminders ────────────────────────────────────────────────────── */}
      <AccordionSection
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        }
        title="Reminders"
        subtitle="When and how you get notified"
      >
        <Row label="Push notifications" sublabel={r.enabled ? "Active — you'll be reminded each session" : 'Paused — no reminders will fire'}>
          <Toggle checked={r.enabled} onChange={v => onChange({ reminders: { ...r, enabled: v } })} />
        </Row>

        <div className="px-4 py-3.5 border-b border-[var(--c4)]">
          <p className="text-[var(--ct0)] text-sm mb-0.5">Active hours</p>
          <p className="text-[var(--ct2)] text-xs mb-3">Reminders only fire within this window</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[var(--ct2)] text-xs block mb-1">Start</label>
              <input
                type="time"
                value={`${String(r.startHour).padStart(2, '0')}:${String(r.startMinute ?? 0).padStart(2, '0')}`}
                onChange={e => {
                  const [h, m] = e.target.value.split(':').map(Number);
                  onChange({ reminders: { ...r, startHour: h, startMinute: m } });
                }}
                className="w-full bg-[var(--c4)] border border-[var(--c5)] rounded-xl px-3 py-2 text-sm text-[var(--ct0)] focus:border-[#FACC15]/50 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[var(--ct2)] text-xs block mb-1">End</label>
              <input
                type="time"
                value={`${String(r.endHour).padStart(2, '0')}:${String(r.endMinute ?? 0).padStart(2, '0')}`}
                onChange={e => {
                  const [h, m] = e.target.value.split(':').map(Number);
                  onChange({ reminders: { ...r, endHour: h, endMinute: m } });
                }}
                className="w-full bg-[var(--c4)] border border-[var(--c5)] rounded-xl px-3 py-2 text-sm text-[var(--ct0)] focus:border-[#FACC15]/50 outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-3.5 border-b border-[var(--c4)]">
          <p className="text-[var(--ct0)] text-sm mb-0.5">Schedule</p>
          <p className="text-[var(--ct2)] text-xs mb-3">How often reminders are sent within your active hours</p>
          <SegmentControl<ScheduleMode>
            options={[
              { value: 'auto',   label: 'Every hour' },
              { value: 'custom', label: 'Custom' },
            ]}
            value={r.scheduleMode ?? 'auto'}
            onChange={v => onChange({ reminders: { ...r, scheduleMode: v } })}
          />
          {r.scheduleMode === 'custom' && (
            <div className="mt-3">
              <p className="text-[var(--ct2)] text-xs mb-2">Minutes past each hour</p>
              <div className="flex flex-wrap gap-1.5">
                {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(min => {
                  const selected = (r.customMinutes ?? []).includes(min);
                  return (
                    <button
                      key={min}
                      onClick={() => {
                        const next = selected
                          ? (r.customMinutes ?? []).filter(m => m !== min)
                          : [...(r.customMinutes ?? []), min].sort((a, b) => a - b);
                        onChange({ reminders: { ...r, customMinutes: next } });
                      }}
                      className={`w-11 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        selected
                          ? 'bg-[#FACC15] text-[#0B1C2D]'
                          : 'bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct2)] hover:text-[var(--ct1)]'
                      }`}
                    >:{String(min).padStart(2, '0')}</button>
                  );
                })}
              </div>
              {(r.customMinutes ?? []).length === 0 && (
                <p className="text-[var(--ct2)] text-xs mt-2 opacity-60">Select at least one time mark.</p>
              )}
            </div>
          )}
        </div>

        <Row label="Snooze duration" sublabel="How long to delay a snoozed session">
          <div className="flex items-center gap-2">
            <Stepper value={r.snoozeMinutes} min={1} max={60}
              onChange={v => onChange({ reminders: { ...r, snoozeMinutes: v } })} />
            <span className="text-[var(--ct2)] text-xs">min</span>
          </div>
        </Row>

        <div className="px-4 py-3.5 border-b border-[var(--c4)]">
          <p className="text-[var(--ct0)] text-sm mb-0.5">Alert style</p>
          <p className="text-[var(--ct2)] text-xs mb-3">How reminders get your attention</p>
          <SegmentControl<AlertStyle>
            options={[
              { value: 'sound',   label: 'Sound' },
              { value: 'vibrate', label: 'Vibrate' },
              { value: 'both',    label: 'Both' },
            ]}
            value={r.alertStyle ?? 'sound'}
            onChange={v => onChange({ reminders: { ...r, alertStyle: v } })}
          />
        </div>

        {(r.alertStyle === 'sound' || r.alertStyle === 'both') && (
          <div className="px-4 py-3.5 border-b border-[var(--c4)]">
            <p className="text-[var(--ct0)] text-sm mb-0.5">Notification sound</p>
            <p className="text-[var(--ct2)] text-xs mb-3">Choose and preview your alert sound</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={r.notificationSound ?? 'double-beep'}
                  onChange={e => onChange({ reminders: { ...r, notificationSound: e.target.value as NotificationSound } })}
                  className="w-full appearance-none bg-[var(--c4)] border border-[var(--c5)] rounded-xl px-3 py-2.5 text-sm text-[var(--ct0)] focus:border-[#FACC15]/50 outline-none pr-8 cursor-pointer"
                >
                  {NOTIFICATION_SOUNDS.map(s => (
                    <option key={s.id} value={s.id}>{s.label} — {s.description}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ct2)]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <button
                onClick={() => NotificationService.playSound(r.notificationSound ?? 'double-beep')}
                className="px-3 py-2.5 rounded-xl bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct1)] hover:border-[var(--ca)]/40 hover:text-[var(--ct0)] transition-colors shrink-0"
                title="Preview sound"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
            </div>
          </div>
        )}

        <div className="px-4 py-3.5 flex gap-2">
          <button
            onClick={() => NotificationService.triggerAlert(r.alertStyle ?? 'sound', r.notificationSound)}
            className="flex-1 py-2.5 rounded-xl bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct1)] text-xs font-semibold hover:border-[var(--ca)]/40 hover:text-[var(--ct0)] transition-colors"
          >Test Alarm</button>
          <button
            onClick={onTestNotification}
            className="flex-1 py-2.5 rounded-xl bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct1)] text-xs font-semibold hover:border-[var(--ca)]/40 hover:text-[var(--ct0)] transition-colors"
          >Test Notification</button>
        </div>
      </AccordionSection>

      {/* ── 4. Team & Privacy ───────────────────────────────────────────────── */}
      <AccordionSection
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        }
        title="Team & Privacy"
        subtitle="Control what your coworkers can see"
      >
        <Row label="Show on leaderboard" sublabel="Let teammates see your rank">
          <Toggle checked={showOnLeaderboard} onChange={setShowOnLeaderboard} />
        </Row>
        <Row label="Share completion stats" sublabel="Your % visible on the team feed">
          <Toggle checked={showStats} onChange={setShowStats} />
        </Row>
        <Row label="Show missed sessions" sublabel="Visible to teammates when you skip">
          <Toggle checked={showMissed} onChange={setShowMissed} />
        </Row>

        {/* Teams list */}
        <div className="px-4 py-3.5 border-b border-[var(--c4)]">
          <p className="text-[var(--ct0)] text-sm mb-0.5">Your teams</p>
          <p className="text-[var(--ct2)] text-xs mb-3">Invite codes and pending requests for each team</p>
          {teams.length === 0 ? (
            <p className="text-[var(--ct2)] text-xs italic">No teams yet. Go to the Team tab to create or join one.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {teams.map(team => {
                const pending = team.members.filter(m => m.role === 'pending');
                const inviteText = `Join my BreakRep team "${team.name}"! Use code ${team.code} to join.`;
                return (
                  <div key={team.id} className="flex flex-col gap-2">
                    {team.isAdmin && (
                      <div className="bg-[var(--c4)] border border-[var(--c5)] rounded-2xl p-3 text-center">
                        <p className="text-[var(--ct2)] text-xs mb-1">{team.name}</p>
                        <p className="text-[#FACC15] text-2xl font-black tracking-[0.2em]">{team.code}</p>
                        <div className="flex gap-2 mt-2 justify-center">
                          <a href={`sms:?body=${encodeURIComponent(inviteText)}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--c5)] text-[var(--ct1)] text-xs font-semibold hover:border-[var(--ca)]/40 hover:text-[var(--ct0)] transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            Text
                          </a>
                          <a href={`mailto:?subject=${encodeURIComponent(`Join ${team.name} on BreakRep`)}&body=${encodeURIComponent(inviteText)}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--c5)] text-[var(--ct1)] text-xs font-semibold hover:border-[var(--ca)]/40 hover:text-[var(--ct0)] transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            Email
                          </a>
                        </div>
                      </div>
                    )}
                    {!team.isAdmin && (
                      <div className="bg-[var(--c4)] border border-[var(--c5)] rounded-xl px-3 py-2.5 flex items-center justify-between">
                        <p className="text-[var(--ct0)] text-sm font-semibold">{team.name}</p>
                        <span className="text-[var(--ct2)] text-xs">Member</span>
                      </div>
                    )}
                    {/* Pending requests for admin teams */}
                    {team.isAdmin && pending.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[var(--ct2)] text-xs font-semibold flex items-center gap-1.5">
                          Pending requests
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold">{pending.length}</span>
                        </p>
                        {pending.map(m => (
                          <div key={m.id} className="flex items-center gap-3 bg-[var(--c4)] border border-[var(--c5)] rounded-xl px-3 py-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                              {m.displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <p className="text-[var(--ct0)] text-sm flex-1 truncate">{m.displayName}</p>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => onChange({ teams: teams.map(t => t.id === team.id ? { ...t, members: t.members.map(x => x.id === m.id ? { ...x, role: 'member' as const } : x) } : t) })}
                                className="px-2 py-1 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-xs font-semibold hover:bg-[#22C55E]/25 transition-colors"
                              >Approve</button>
                              <button
                                onClick={() => onChange({ teams: teams.map(t => t.id === team.id ? { ...t, members: t.members.filter(x => x.id !== m.id) } : t) })}
                                className="px-2 py-1 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/20 transition-colors"
                              >Reject</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AccordionSection>

      {/* ── 5. App Preferences ──────────────────────────────────────────────── */}
      <AccordionSection
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/>
          </svg>
        }
        title="App Preferences"
        subtitle="Display and formatting options"
      >
        <div className="px-4 py-3.5 border-b border-[var(--c4)]">
          <p className="text-[var(--ct0)] text-sm mb-0.5">Theme</p>
          <p className="text-[var(--ct2)] text-xs mb-3">Choose your app color scheme</p>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map(t => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all ${
                    isActive ? 'border-[#FACC15]' : 'border-transparent hover:border-[var(--c6)]'
                  }`}
                  style={{ background: t.bg }}
                >
                  <div className="w-full h-8 rounded-lg flex items-center justify-center gap-1" style={{ background: t.card }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.text, opacity: 0.5 }} />
                    <div className="w-3 h-1 rounded-full" style={{ background: t.text, opacity: 0.4 }} />
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: t.text }}>{t.label}</span>
                  {isActive && (
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#FACC15] rounded-full flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#0B1C2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3.5">
          <p className="text-[var(--ct0)] text-sm mb-0.5">Time format</p>
          <p className="text-[var(--ct2)] text-xs mb-3">How session times are displayed throughout the app</p>
          <SegmentControl<'12h' | '24h'>
            options={[
              { value: '12h', label: '12-hour  (3:00 PM)' },
              { value: '24h', label: '24-hour  (15:00)' },
            ]}
            value={timeFormat}
            onChange={setTimeFormat}
          />
        </div>
      </AccordionSection>

      {/* ── 6. Support ──────────────────────────────────────────────────────── */}
      <AccordionSection
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        }
        title="Support"
        subtitle="Help, feedback, and legal"
      >
        <NavRow label="Help & FAQ" sublabel="How BreakRep works" onPress={() => {}} />
        <NavRow label="Send feedback" sublabel="Share ideas or report issues" onPress={() => {}} />
        <NavRow label="Privacy Policy" onPress={() => {}} />
        <NavRow label="Terms of Service" onPress={() => {}} />
      </AccordionSection>

      {/* ── 7. Account ──────────────────────────────────────────────────────── */}
      <AccordionSection
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        }
        title="Account"
        subtitle="Sign out and data management"
      >
        <button className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[var(--c4)] hover:bg-[var(--c4)]/50 transition-colors text-left">
          <p className="text-[var(--ct0)] text-sm">Sign out</p>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ct2)" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>

        <div className="px-4 py-3.5 border-b border-[var(--c4)]">
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} className="w-full flex items-center justify-between text-left">
              <div>
                <p className="text-[#FB923C] text-sm">Reset all progress</p>
                <p className="text-[var(--ct2)] text-xs mt-0.5">Clear sessions and return to setup</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[var(--ct0)] text-sm font-semibold">Reset all progress?</p>
              <p className="text-[var(--ct2)] text-xs">All sessions will be deleted and you'll be returned to the setup screen. This cannot be undone.</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { onReset(); setConfirmReset(false); }}
                  className="flex-1 py-2 rounded-xl bg-[#FB923C] text-white text-sm font-bold hover:bg-[#EA580C] transition-colors"
                >Yes, reset everything</button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct1)] text-sm font-semibold transition-colors"
                >Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3.5">
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center justify-between text-left">
              <div>
                <p className="text-[#EF4444] text-sm">Delete account</p>
                <p className="text-[var(--ct2)] text-xs mt-0.5">Permanently remove all your data</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[#EF4444] text-sm font-semibold">Delete account?</p>
              <p className="text-[var(--ct2)] text-xs">All your data will be permanently erased. This action cannot be undone.</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { onReset(); setConfirmDelete(false); }}
                  className="flex-1 py-2 rounded-xl bg-[#EF4444] text-white text-sm font-bold hover:bg-[#DC2626] transition-colors"
                >Yes, delete account</button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--c4)] border border-[var(--c5)] text-[var(--ct1)] text-sm font-semibold transition-colors"
                >Cancel</button>
              </div>
            </div>
          )}
        </div>
      </AccordionSection>

      <p className="text-center text-[var(--c5)] text-xs pb-2">BreakRep v0.1.0</p>
    </div>
  );
}
