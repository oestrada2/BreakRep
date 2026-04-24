import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import type { AppSettings, ExperienceLevel, EnabledExercises, Team } from '@/types';
import { Button } from '@/components/ui/Button';
import { NotificationService } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

function getEmail(sessionEmail: string | null | undefined): string {
  if (sessionEmail) return sessionEmail;
  try {
    const p = JSON.parse(localStorage.getItem('puh_profile') ?? '{}');
    return p.email ?? '';
  } catch { return ''; }
}

const PRESETS: Record<ExperienceLevel, Partial<AppSettings['progression']>> = {
  beginner:     { startingReps: 5,  increaseAmount: 2, increaseEveryDays: 3, maxReps: 30 },
  intermediate: { startingReps: 10, increaseAmount: 3, increaseEveryDays: 3, maxReps: 50 },
  advanced:     { startingReps: 15, increaseAmount: 5, increaseEveryDays: 2, maxReps: 100 },
};

function calcLevelFromReps(reps: number): ExperienceLevel {
  if (reps >= 20) return 'advanced';
  if (reps >= 8)  return 'intermediate';
  return 'beginner';
}

interface OnboardingWizardProps {
  onComplete: (settings: Partial<AppSettings>) => void;
  isReturningUser?: boolean;
}

// ─── Shared layout shell ──────────────────────────────────────────────────────
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--c0)] flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {children}
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-xl bg-[#FACC15] flex items-center justify-center shadow-lg shadow-yellow-500/20">
        <span className="text-[#0B1C2D] text-lg font-black leading-none">B</span>
      </div>
      <span className="text-[var(--ct0)] text-xl font-bold tracking-tight">BreakRep</span>
    </div>
  );
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? 'w-6 bg-[#FACC15]' : 'w-1.5 bg-[var(--c5)]'
          }`}
        />
      ))}
    </div>
  );
}

function RadioCheck({ selected }: { selected: boolean }) {
  return (
    <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
      selected ? 'border-[#FACC15] bg-[#FACC15]' : 'border-[var(--c5)]'
    }`}>
      {selected && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#0B1C2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

// ─── Screen 1: Welcome ────────────────────────────────────────────────────────
function WelcomeScreen({ onNext, onLogin, isReturningUser }: {
  onNext: () => void;
  onLogin: () => void;
  isReturningUser: boolean;
}) {
  return (
    <Screen>
      <Logo />
      <div className="rounded-2xl bg-[var(--c2)] border border-[var(--c5)] p-8 flex flex-col items-center gap-4 shadow-xl">
        <div className="flex gap-3 items-end">
          <div className="w-10 h-10 rounded-full bg-[#22C55E]/20 flex items-center justify-center text-2xl">💪</div>
          <div className="w-14 h-14 rounded-full bg-[#FACC15]/20 flex items-center justify-center text-3xl">🏃</div>
          <div className="w-10 h-10 rounded-full bg-[var(--ca)]/20 flex items-center justify-center text-2xl">📈</div>
        </div>
        <div className="text-center">
          <h1 className="text-[var(--ct0)] text-2xl font-bold leading-tight mb-2">
            Take smarter breaks<br />during your workday
          </h1>
          <p className="text-[var(--ct1)] text-sm leading-relaxed">
            Build consistency with quick movement sessions, progress tracking, and team accountability.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Button variant="primary" size="lg" className="w-full" onClick={onNext}>
          Get Started
        </Button>
        {isReturningUser && (
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-[var(--ct1)] hover:text-[var(--ct0)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Already have an account? Log in
          </button>
        )}
      </div>
      <StepDots total={7} current={0} />
    </Screen>
  );
}

// ─── Screen 2: How it works ───────────────────────────────────────────────────
function HowItWorksScreen({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const cards = [
    { icon: '🏋️', color: '#FACC15', bg: 'bg-[#FACC15]/10', title: 'Move',             desc: 'Complete quick office-friendly exercises during scheduled breaks throughout your day.' },
    { icon: '📊', color: '#22C55E', bg: 'bg-[#22C55E]/10', title: 'Track',            desc: 'Log sessions automatically and watch your consistency grow over time.' },
    { icon: '👥', color: 'var(--ca)', bg: 'bg-[var(--ca)]/10', title: 'Stay Accountable', desc: 'Join your team, compare progress, and keep each other motivated.' },
  ];
  return (
    <Screen>
      <Logo />
      <div>
        <h2 className="text-[var(--ct0)] text-2xl font-bold mb-1">How it works</h2>
        <p className="text-[var(--ct1)] text-sm">Three steps to a healthier workday.</p>
      </div>
      <div className="flex flex-col gap-3">
        {cards.map(c => (
          <div key={c.title} className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-4 flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center text-2xl shrink-0`}>{c.icon}</div>
            <div>
              <p className="font-semibold text-sm mb-0.5" style={{ color: c.color }}>{c.title}</p>
              <p className="text-[var(--ct1)] text-xs leading-relaxed">{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Button variant="primary" size="lg" className="w-full" onClick={onNext}>Continue</Button>
        <button onClick={onSkip} className="text-[var(--ct1)] text-sm text-center hover:text-[var(--ct0)] transition-colors">Skip for now</button>
      </div>
      <StepDots total={7} current={1} />
    </Screen>
  );
}

// ─── Screen 2: Workout selection ─────────────────────────────────────────────
const EXERCISES: { key: string; label: string; emoji: string; desc: string }[] = [
  { key: 'pushups', label: 'Push-ups',  emoji: '💪', desc: 'Upper body — chest, shoulders, triceps' },
  { key: 'squats',  label: 'Squats',    emoji: '🦵', desc: 'Lower body — quads, glutes, hamstrings' },
  { key: 'situps',  label: 'Plank',     emoji: '⏱️', desc: 'Core — hold position for time (seconds)' },
];

function WorkoutSelectScreen({
  selected,
  customLabels,
  customTrackingTypes,
  onToggle,
  onAddCustom,
  onRemoveCustom,
  onNext,
  onBack,
}: {
  selected: EnabledExercises;
  customLabels: Record<string, string>;
  customTrackingTypes: Record<string, 'reps' | 'time'>;
  onToggle: (key: string) => void;
  onAddCustom: (label: string, trackingType: 'reps' | 'time') => void;
  onRemoveCustom: (key: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [newTrackingType, setNewTrackingType] = useState<'reps' | 'time'>('reps');
  const enabledCount = Object.values(selected).filter(Boolean).length;
  const customKeys = Object.keys(customLabels);

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAddCustom(trimmed, newTrackingType);
    setInputValue('');
    setNewTrackingType('reps');
  };

  return (
    <Screen>
      <Logo />
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h2 className="text-[var(--ct0)] text-2xl font-bold mb-1">Pick your exercises</h2>
        <p className="text-[var(--ct1)] text-sm leading-relaxed">
          Choose which movements to include in every session. You can change this anytime in Settings.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {EXERCISES.map(ex => {
          const isOn = selected[ex.key] ?? false;
          return (
            <button
              key={ex.key}
              onClick={() => {
                if (isOn && enabledCount === 1) return;
                onToggle(ex.key);
              }}
              className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-150 ${
                isOn
                  ? 'border-[#FACC15] bg-[var(--c2)]'
                  : 'border-[var(--c5)] bg-[var(--c2)] opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-colors ${
                  isOn ? 'bg-[#FACC15]/10' : 'bg-[var(--c4)]'
                }`}>
                  {ex.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--ct0)] text-sm font-bold">{ex.label}</p>
                  <p className="text-[var(--ct2)] text-xs mt-0.5">{ex.desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-colors ${
                  isOn ? 'border-[#FACC15] bg-[#FACC15]' : 'border-[var(--c5)]'
                }`}>
                  {isOn && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#0B1C2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* Custom exercises */}
        {customKeys.map(key => {
          const isOn = selected[key] ?? true;
          const trackingType = customTrackingTypes[key] ?? 'reps';
          return (
            <div
              key={key}
              className={`w-full rounded-2xl border-2 p-4 transition-all duration-150 ${
                isOn ? 'border-[#FACC15] bg-[var(--c2)]' : 'border-[var(--c5)] bg-[var(--c2)] opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { if (isOn && enabledCount === 1) return; onToggle(key); }}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors ${
                    isOn ? 'bg-[#FACC15]/10' : 'bg-[var(--c4)]'
                  }`}>
                    {trackingType === 'time' ? '⏱️' : '🏋️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--ct0)] text-sm font-bold">{customLabels[key]}</p>
                    <p className="text-[var(--ct2)] text-xs mt-0.5">{trackingType === 'time' ? 'Timed exercise (seconds)' : 'Rep-based exercise'}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    onClick={() => { if (isOn && enabledCount === 1) return; onToggle(key); }}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer ${
                      isOn ? 'border-[#FACC15] bg-[#FACC15]' : 'border-[var(--c5)]'
                    }`}
                  >
                    {isOn && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#0B1C2D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveCustom(key)}
                    className="w-5 h-5 flex items-center justify-center text-[var(--ct2)] hover:text-red-400 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add custom exercise row */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Add your own exercise…"
            className="flex-1 bg-[var(--c2)] border border-[var(--c5)] rounded-xl px-3 py-2.5 text-sm text-[var(--ct0)] placeholder-[var(--ct2)] focus:outline-none focus:border-[var(--ca)] transition-colors"
          />
          <div className="flex shrink-0 rounded-xl border border-[var(--c5)] overflow-hidden text-xs font-semibold">
            <button type="button" onClick={() => setNewTrackingType('reps')}
              className={`px-2.5 py-2 transition-colors ${newTrackingType === 'reps' ? 'bg-[var(--ca)] text-white' : 'text-[var(--ct2)]'}`}>
              Reps
            </button>
            <button type="button" onClick={() => setNewTrackingType('time')}
              className={`px-2.5 py-2 transition-colors ${newTrackingType === 'time' ? 'bg-[var(--ca)] text-white' : 'text-[var(--ct2)]'}`}>
              Time
            </button>
          </div>
          <button
            onClick={handleAdd}
            disabled={!inputValue.trim()}
            className="w-10 h-10 shrink-0 rounded-xl bg-[var(--ca)] flex items-center justify-center transition-opacity disabled:opacity-30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      {enabledCount === 1 && (
        <p className="text-[var(--ct2)] text-xs text-center -mt-1">At least one exercise must be selected.</p>
      )}

      <Button variant="primary" size="lg" className="w-full" onClick={onNext}>
        Continue
      </Button>

      <StepDots total={7} current={2} />
    </Screen>
  );
}

// ─── Screen 3a: Starting point choice ────────────────────────────────────────
function StartingPointScreen({
  onAssessment,
  onManual,
  onBack,
}: {
  onAssessment: () => void;
  onManual: () => void;
  onBack: () => void;
}) {
  return (
    <Screen>
      <Logo />
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h2 className="text-[var(--ct0)] text-2xl font-bold mb-1">Find your starting point</h2>
        <p className="text-[var(--ct1)] text-sm leading-relaxed">
          Take a quick assessment for a more personalized plan, or choose your level manually.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Assessment option */}
        <button
          onClick={onAssessment}
          className="w-full text-left bg-[var(--c2)] border-2 border-[#FACC15] rounded-2xl p-4 hover:bg-[var(--c4)] transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FACC15]/10 shrink-0 flex items-center justify-center text-xl">📋</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[var(--ct0)] text-sm font-bold">Quick Assessment</p>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FACC15]/15 text-[#FACC15]">Recommended</span>
              </div>
              <p className="text-[var(--ct1)] text-xs leading-relaxed">Helps personalize your starting plan based on your actual ability.</p>
            </div>
          </div>
        </button>

        {/* Manual option */}
        <button
          onClick={onManual}
          className="w-full text-left bg-[var(--c2)] border-2 border-[var(--c5)] rounded-2xl p-4 hover:border-[#2A4A6B] transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--ca)]/10 shrink-0 flex items-center justify-center text-xl">⚙️</div>
            <div className="flex-1 min-w-0">
              <p className="text-[var(--ct0)] text-sm font-bold mb-0.5">Choose Manually</p>
              <p className="text-[var(--ct1)] text-xs leading-relaxed">Pick Beginner, Intermediate, or Advanced.</p>
            </div>
          </div>
        </button>
      </div>

      <StepDots total={7} current={3} />
    </Screen>
  );
}

// ─── Screen 3b: Assessment — push-up test ────────────────────────────────────
function AssessmentRepsScreen({
  onNext,
  onBack,
}: {
  onNext: (reps: number) => void;
  onBack: () => void;
}) {
  const [reps, setReps] = useState('');
  const parsed = parseInt(reps, 10);
  const valid = !isNaN(parsed) && parsed >= 0;

  return (
    <Screen>
      <Logo />
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h2 className="text-[var(--ct0)] text-2xl font-bold mb-1">Push-up Assessment</h2>
        <p className="text-[var(--ct1)] text-sm leading-relaxed">Do as many clean push-ups as you can. Stop when your form breaks down or you can't complete another clean rep.</p>
      </div>

      <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3 p-3 bg-[var(--c4)] rounded-xl border border-[var(--c5)]">
          <span className="text-lg">💪</span>
          <p className="text-[var(--ct1)] text-xs leading-relaxed">Go at a steady pace. Keep your back straight, chest to the floor, full extension at the top.</p>
        </div>

        <div>
          <label className="text-[var(--ct2)] text-xs font-medium uppercase tracking-wide block mb-2">Reps completed</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="e.g. 12"
            value={reps}
            onChange={e => setReps(e.target.value)}
            className="w-full bg-[var(--c4)] border border-[var(--c5)] rounded-xl px-4 py-3 text-[var(--ct0)] text-lg font-bold text-center focus:border-[#FACC15]/50 outline-none transition-colors placeholder-[var(--ct2)]"
          />
          <p className="text-[var(--ct2)] text-xs mt-2 text-center">Do not count partial reps.</p>
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => valid && onNext(parsed)}
      >
        Next
      </Button>

      <StepDots total={7} current={3} />
    </Screen>
  );
}

// ─── Screen 3c: Assessment — result ──────────────────────────────────────────
function AssessmentResultScreen({
  reps,
  level,
  onNext,
  onBack,
}: {
  reps: number;
  level: ExperienceLevel;
  onNext: () => void;
  onBack: () => void;
}) {
  const META: Record<ExperienceLevel, { label: string; color: string; bg: string; desc: string }> = {
    beginner:     { label: 'Beginner',     color: 'var(--ca)', bg: 'bg-[var(--ca)]/10', desc: `Starting at ${PRESETS.beginner.startingReps} reps per session with a gentle progression — enough to build the habit without overdoing it.` },
    intermediate: { label: 'Intermediate', color: '#FACC15', bg: 'bg-[#FACC15]/10', desc: `Starting at ${PRESETS.intermediate.startingReps} reps per session with steady weekly increases — a solid challenge without burning out.` },
    advanced:     { label: 'Advanced',     color: '#22C55E', bg: 'bg-[#22C55E]/10', desc: `Starting at ${PRESETS.advanced.startingReps} reps per session with faster progression — keeps it challenging as you build consistency.` },
  };
  const m = META[level];

  return (
    <Screen>
      <Logo />
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h2 className="text-[var(--ct0)] text-2xl font-bold mb-1">Your recommended level</h2>
        <p className="text-[var(--ct1)] text-sm">Based on your assessment results.</p>
      </div>

      <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-5 space-y-4">
        {/* Rep count summary */}
        <div className="pb-4 border-b border-[var(--c4)]">
          <p className="text-[var(--ct2)] text-xs mb-0.5">Push-ups completed</p>
          <p className="text-[var(--ct0)] text-2xl font-bold">{reps} reps</p>
        </div>

        {/* Recommended level */}
        <div className={`${m.bg} rounded-xl p-4 flex items-start gap-3`}>
          <div className="w-10 h-10 rounded-xl bg-[var(--c2)]/60 flex items-center justify-center shrink-0">
            <div className="w-4 h-4 rounded-full" style={{ background: m.color }} />
          </div>
          <div>
            <p className="text-xs text-[var(--ct2)] uppercase tracking-wide mb-0.5">Recommended</p>
            <p className="font-bold text-lg" style={{ color: m.color }}>{m.label}</p>
            <p className="text-[var(--ct1)] text-xs leading-relaxed mt-1">{m.desc}</p>
          </div>
        </div>

        <p className="text-[var(--ct2)] text-xs text-center">You can change this anytime in Settings.</p>
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={onNext}>
        Start with {m.label}
      </Button>

      <StepDots total={7} current={3} />
    </Screen>
  );
}

// ─── Screen 3e: Manual level select ──────────────────────────────────────────
function ManualLevelScreen({
  selected,
  onSelect,
  onNext,
  onBack,
}: {
  selected: ExperienceLevel;
  onSelect: (l: ExperienceLevel) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const levels: { value: ExperienceLevel; label: string; sublabel: string; reps: string; accent: string; bg: string }[] = [
    { value: 'beginner',     label: 'Beginner',     sublabel: 'Just getting started',  reps: '5 reps',  accent: 'var(--ca)', bg: 'bg-[var(--ca)]/10' },
    { value: 'intermediate', label: 'Intermediate', sublabel: 'Reasonably active',      reps: '10 reps', accent: '#FACC15', bg: 'bg-[#FACC15]/10' },
    { value: 'advanced',     label: 'Advanced',     sublabel: 'Regularly trains',        reps: '15 reps', accent: '#22C55E', bg: 'bg-[#22C55E]/10' },
  ];

  return (
    <Screen>
      <Logo />
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <h2 className="text-[var(--ct0)] text-2xl font-bold mb-1">Choose your starting level</h2>
        <p className="text-[var(--ct1)] text-sm">BreakRep will use this to personalize your starting plan.</p>
      </div>

      <div className="flex flex-col gap-3">
        {levels.map(l => {
          const isSelected = selected === l.value;
          return (
            <button
              key={l.value}
              onClick={() => onSelect(l.value)}
              className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-150 ${
                isSelected ? 'border-[#FACC15] bg-[var(--c2)]' : 'border-[var(--c5)] bg-[var(--c2)] hover:border-[#2A4A6B]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${l.bg} shrink-0 flex items-center justify-center`}>
                  <div className="w-4 h-4 rounded-full" style={{ background: l.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--ct0)] text-sm font-bold">{l.label}</p>
                  <p className="text-[var(--ct2)] text-xs mt-0.5">{l.sublabel}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full mr-2" style={{ background: `${l.accent}20`, color: l.accent }}>
                  Start at {l.reps}
                </span>
                <RadioCheck selected={isSelected} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <Button variant="primary" size="lg" className="w-full" onClick={onNext}>
          Continue
        </Button>
        <p className="text-[var(--ct2)] text-xs text-center">You can change this later in Settings.</p>
      </div>

      <StepDots total={7} current={3} />
    </Screen>
  );
}

// ─── Screen 4: Notifications ──────────────────────────────────────────────────
function NotificationsScreen({ onNext, onSkip, onBack }: { onNext: () => void; onSkip: () => void; onBack: () => void }) {
  const handleEnable = async () => {
    await NotificationService.requestPermission();
    onNext();
  };
  return (
    <Screen>
      <Logo />
      <button onClick={onBack} className="flex items-center gap-1.5 text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors -mb-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
      <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#FACC15]/10 flex items-center justify-center">
          <span className="text-5xl">🔔</span>
        </div>
        <div>
          <h2 className="text-[var(--ct0)] text-xl font-bold mb-2">Stay consistent</h2>
          <p className="text-[var(--ct1)] text-sm leading-relaxed">
            Enable notifications so BreakRep can remind you when it's time for a movement break. You won't miss a session.
          </p>
        </div>
        <div className="w-full bg-[var(--c4)] rounded-xl p-3 flex items-center gap-3 border border-[var(--c5)]">
          <div className="w-8 h-8 rounded-lg bg-[#FACC15] flex items-center justify-center text-sm font-black text-[#0B1C2D]">B</div>
          <div className="text-left">
            <p className="text-[var(--ct0)] text-xs font-semibold">BreakRep</p>
            <p className="text-[var(--ct1)] text-xs">💪 Time for a break — do 10 reps</p>
          </div>
          <span className="ml-auto text-[var(--ct1)] text-xs">now</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Button variant="primary" size="lg" className="w-full" onClick={handleEnable}>Enable Notifications</Button>
        <button onClick={onSkip} className="text-[var(--ct1)] text-sm text-center hover:text-[var(--ct0)] transition-colors">Maybe Later</button>
      </div>
      <StepDots total={7} current={4} />
    </Screen>
  );
}

// ─── Screen 5: Sign in ────────────────────────────────────────────────────────
function SignInScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = name.trim().length > 0 && emailValid && password.length >= 8;

  if (showEmailForm) {
    return (
      <Screen>
        <button onClick={() => setShowEmailForm(false)} className="flex items-center gap-1.5 text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div className="flex flex-col gap-2">
          <h2 className="text-[var(--ct0)] text-2xl font-bold">Create your account</h2>
          <p className="text-[var(--ct1)] text-sm">Enter your details to get started.</p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--ct1)] text-xs font-medium">Full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full bg-[var(--c2)] border border-[var(--c5)] rounded-xl px-4 py-3 text-sm text-[var(--ct0)] placeholder:text-[var(--ct2)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--ct1)] text-xs font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full bg-[var(--c2)] border border-[var(--c5)] rounded-xl px-4 py-3 text-sm text-[var(--ct0)] placeholder:text-[var(--ct2)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--ct1)] text-xs font-medium">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full bg-[var(--c2)] border border-[var(--c5)] rounded-xl px-4 py-3 pr-11 text-sm text-[var(--ct0)] placeholder:text-[var(--ct2)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ct2)] hover:text-[var(--ct1)] transition-colors"
              >
                {showPassword
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {password.length > 0 && password.length < 8 && (
              <p className="text-xs text-red-400">Password must be at least 8 characters</p>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            if (!canSubmit) return;
            // Persist email so it's available as a fallback when no OAuth session exists
            try {
              const existing = JSON.parse(localStorage.getItem('puh_profile') ?? '{}');
              localStorage.setItem('puh_profile', JSON.stringify({ ...existing, email, displayName: name.trim() }));
            } catch {}
            onNext();
          }}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] rounded-xl py-3.5 text-sm text-white font-semibold transition-opacity disabled:opacity-40"
        >
          Create Account
        </button>
        <p className="text-center text-[var(--ct2)] text-xs">
          Already have an account?{' '}
          <button onClick={() => setShowEmailForm(false)} className="text-[var(--ct1)] underline underline-offset-2 hover:text-[var(--ct0)] transition-colors">
            Sign in
          </button>
        </p>
        <StepDots total={7} current={5} />
      </Screen>
    );
  }

  return (
    <Screen>
      <button onClick={onBack} className="flex items-center gap-1.5 text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo />
        <h2 className="text-[var(--ct0)] text-2xl font-bold mt-2">Sign in to join BreakRep</h2>
        <p className="text-[var(--ct1)] text-sm leading-relaxed max-w-xs">
          Track your sessions, join a team, and compare progress with your coworkers.
        </p>
      </div>
      <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3 text-[var(--ct1)] text-xs"><span className="text-lg">📈</span> Track sessions and build streaks</div>
        <div className="w-full h-px bg-[var(--c5)]" />
        <div className="flex items-center gap-3 text-[var(--ct1)] text-xs"><span className="text-lg">👥</span> Join your team and compare progress</div>
        <div className="w-full h-px bg-[var(--c5)]" />
        <div className="flex items-center gap-3 text-[var(--ct1)] text-xs"><span className="text-lg">🏆</span> Earn badges and hit milestones</div>
      </div>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => signIn('google', { callbackUrl: '/?onboarding=1' })}
          className="w-full flex items-center justify-center gap-3 bg-white rounded-xl py-3.5 text-sm text-[#0B1C2D] font-semibold hover:bg-gray-100 transition-colors shadow-lg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--c5)]" />
          <span className="text-[var(--ct2)] text-xs">or</span>
          <div className="flex-1 h-px bg-[var(--c5)]" />
        </div>
        <button
          onClick={() => setShowEmailForm(true)}
          className="w-full flex items-center justify-center gap-3 bg-transparent border border-[var(--c5)] rounded-xl py-3.5 text-sm text-[var(--ct1)] font-semibold hover:border-[var(--ct2)] hover:text-[var(--ct0)] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          Continue with Email
        </button>
      </div>
      <StepDots total={7} current={5} />
    </Screen>
  );
}

// ─── Team creation sheet ──────────────────────────────────────────────────────
function generateTeamCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function TeamSheet({ onClose, onTeamCreated }: { onClose: () => void; onTeamCreated?: (name: string, code: string, org: string) => void }) {
  const { data: session } = useSession();
  const [teamName, setTeamName] = useState('');
  const [organization, setOrganization] = useState('');
  const [orgSuggestions, setOrgSuggestions] = useState<string[]>([]);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [teamCode, setTeamCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const email = getEmail(session?.user?.email);
    if (!email) return;
    const domain = email.split('@')[1]?.split('.')[0]?.toLowerCase() ?? '';
    const consumerProviders = new Set(['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'protonmail', 'aol', 'live', 'msn', 'me', 'mail', 'ymail', 'googlemail']);
    if (domain && !consumerProviders.has(domain)) {
      setOrganization(domain.charAt(0).toUpperCase() + domain.slice(1));
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

  const handleCreate = () => {
    if (!teamName.trim()) return;
    const code = generateTeamCode();
    setTeamCode(code);
    onTeamCreated?.(teamName.trim(), code, organization.trim());
  };

  const inviteText = teamCode
    ? `Join my BreakRep team "${teamName}"! Use code ${teamCode} to join. Download the app and enter the code on the Teams screen.`
    : '';

  const handleCopy = async () => {
    if (!teamCode) return;
    await navigator.clipboard.writeText(teamCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: `Join ${teamName} on BreakRep`, text: inviteText });
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet */}
      <div className="w-full max-w-sm bg-[var(--c1)] border border-[var(--c5)] rounded-3xl p-6 flex flex-col gap-5">
        {/* Handle + header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--ct0)] text-lg font-bold">
              {teamCode ? 'Team created! 🎉' : 'Create a team'}
            </p>
            <p className="text-[var(--ct2)] text-xs mt-0.5">
              {teamCode ? 'Share the code with your crew' : 'Give your team a name to get started'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--c4)] flex items-center justify-center text-[var(--ct2)] hover:text-[var(--ct0)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {!teamCode ? (
          /* ── Name entry state ── */
          <>
            <div>
              <label className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide block mb-1.5">
                Team name
              </label>
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
            <div className="relative">
              <label className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide block mb-1.5">
                Organization <span className="text-[var(--ct2)] normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp, City of Springfield…"
                value={organization}
                onChange={e => handleOrgChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowOrgDropdown(false), 150)}
                onFocus={() => orgSuggestions.length > 0 && setShowOrgDropdown(true)}
                className="w-full bg-[var(--c2)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border border-[var(--c5)] focus:border-[#FACC15] outline-none text-sm transition-colors"
              />
              {showOrgDropdown && (
                <ul className="absolute z-10 top-full mt-1 w-full bg-[var(--c1)] border border-[var(--c5)] rounded-xl shadow-xl overflow-hidden">
                  {orgSuggestions.map(s => (
                    <li key={s}>
                      <button
                        type="button"
                        onMouseDown={() => { setOrganization(s); setShowOrgDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[var(--ct0)] hover:bg-[var(--c4)] transition-colors"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
          /* ── Code + share state ── */
          <>
            {/* Code display */}
            <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-4 text-center">
              <p className="text-[var(--ct2)] text-xs mb-2">Team invite code</p>
              <p className="text-[var(--ct0)] text-4xl font-black tracking-[0.2em] mb-3">{teamCode}</p>
              <p className="text-[var(--ct2)] text-xs">for <span className="text-[var(--ct1)] font-semibold">{teamName}</span></p>
            </div>

            {/* Share options */}
            <div className="grid grid-cols-2 gap-2">
              {/* Copy code */}
              <button
                onClick={handleCopy}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  copied
                    ? 'bg-[#22C55E]/10 border-[#22C55E]/40 text-[#22C55E]'
                    : 'bg-[var(--c2)] border-[var(--c5)] text-[var(--ct1)] hover:border-[var(--ct2)]'
                }`}
              >
                {copied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                )}
                {copied ? 'Copied!' : 'Copy code'}
              </button>

              {/* SMS */}
              <a
                href={`sms:?body=${encodeURIComponent(inviteText)}`}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[var(--c5)] bg-[var(--c2)] text-[var(--ct1)] text-sm font-semibold hover:border-[var(--ct2)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Text
              </a>

              {/* Email */}
              <a
                href={`mailto:?subject=${encodeURIComponent(`Join ${teamName} on BreakRep`)}&body=${encodeURIComponent(inviteText)}`}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[var(--c5)] bg-[var(--c2)] text-[var(--ct1)] text-sm font-semibold hover:border-[var(--ct2)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Email
              </a>

              {/* Native share (WhatsApp / AirDrop / etc.) */}
              {!!navigator.share && (
                <button
                  onClick={handleNativeShare}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[var(--c5)] bg-[var(--c2)] text-[var(--ct1)] text-sm font-semibold hover:border-[var(--ct2)] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  More
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[var(--ct1)] hover:text-[var(--ct0)] transition-colors"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Join team sheet ─────────────────────────────────────────────────────────
function JoinTeamSheet({ onClose, onJoined }: { onClose: () => void; onJoined?: (team: Team) => void }) {
  const { data: session } = useSession();
  const [code, setCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pull display name from profile fields set earlier in the wizard
  const displayName = (() => {
    try {
      const p = JSON.parse(localStorage.getItem('puh_profile') ?? 'null');
      if (!p) return '';
      const fullName = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
      return fullName || p.displayName || '';
    } catch { return ''; }
  })();

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { setError('Please enter a valid invite code.'); return; }
    setLoading(true);
    setError('');

    // Look up the team by code so we have the real name/id
    const { data: teamData } = await supabase
      .from('teams')
      .select('id, name, code, organization')
      .eq('code', trimmed)
      .single();

    if (!teamData) {
      setError('Team not found. Double-check the code and try again.');
      setLoading(false);
      return;
    }

    const email = getEmail(session?.user?.email);

    // Insert join request so admin is notified in real time
    await supabase.from('team_requests').insert({
      id:              'req-' + Date.now(),
      team_id:         teamData.id,
      team_code:       teamData.code,
      team_name:       teamData.name,
      requester_name:  displayName || 'Unknown',
      requester_email: email || null,
      status:          'pending',
    });

    // Update this user's profile row with the team they're joining
    if (email) {
      await supabase.from('profiles').upsert({
        email,
        team:         teamData.name,
        organization: teamData.organization ?? null,
      });
    }

    const pendingTeam: Team = {
      id:       teamData.id,
      name:     teamData.name,
      code:     teamData.code,
      isAdmin:  false,
      members:  [{ id: 'member-' + Date.now(), displayName: displayName || 'You', role: 'pending', joinedAt: Date.now() }],
      joinedAt: Date.now(),
    };

    setLoading(false);
    setJoined(true);
    onJoined?.(pendingTeam);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-[var(--c1)] border border-[var(--c5)] rounded-3xl p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[var(--ct0)] text-lg font-bold">
              {joined ? "Request sent! 🎉" : 'Join a team'}
            </p>
            <p className="text-[var(--ct2)] text-xs mt-0.5">
              {joined ? 'Waiting for admin approval' : 'Enter the invite code shared by your team'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--c4)] flex items-center justify-center text-[var(--ct2)] hover:text-[var(--ct0)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {!joined ? (
          <>
            <div>
              <label className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide block mb-1.5">
                Invite code
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. X4K9MZ"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                maxLength={8}
                className="w-full bg-[var(--c2)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border border-[var(--c5)] focus:border-[#22C55E] outline-none text-sm tracking-widest font-bold uppercase transition-colors text-center"
              />
              {error && <p className="text-[#EF4444] text-xs mt-2">{error}</p>}
            </div>
            <button
              onClick={handleJoin}
              disabled={code.trim().length < 4 || loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#22C55E] text-[#0B1C2D] hover:bg-[#16A34A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Request to join'}
            </button>
          </>
        ) : (
          <>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl shrink-0">⏳</div>
              <div>
                <p className="text-amber-400 text-sm font-semibold">Request sent</p>
                <p className="text-[var(--ct2)] text-xs mt-0.5">
                  Joining as <span className="text-[var(--ct1)] font-semibold">{displayName || 'you'}</span> · waiting for admin approval
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[var(--ct1)] hover:text-[var(--ct0)] transition-colors"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Screen 6: Profile setup ──────────────────────────────────────────────────
function ProfileScreen({ onFinish, onBack, onTeamCreated, onTeamJoined }: {
  onFinish: (displayName: string, firstName: string, lastName: string) => void;
  onBack: () => void;
  onTeamCreated: (name: string, code: string, org: string) => void;
  onTeamJoined: (team: Team) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [name, setName]           = useState('');
  const [showTeamSheet, setShowTeamSheet] = useState(false);
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  const [createdTeam, setCreatedTeam] = useState<{ name: string; code: string } | null>(null);
  const [joinedTeam,  setJoinedTeam]  = useState<Team | null>(null);
  const [touched, setTouched] = useState(false);

  // Auto-populate display name from first + last
  const handleFirstName = (v: string) => {
    setFirstName(v);
    setName(`${v} ${lastName}`.trim());
  };
  const handleLastName = (v: string) => {
    setLastName(v);
    setName(`${firstName} ${v}`.trim());
  };

  const canProceed = firstName.trim().length > 0 && name.trim().length > 0;

  return (
    <>
      <Screen>
        <Logo />
        <button onClick={onBack} className="flex items-center gap-1.5 text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors -mt-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div>
          <h2 className="text-[var(--ct0)] text-2xl font-bold mb-1">Set up your profile</h2>
          <p className="text-[var(--ct1)] text-sm">Let your team know who you are.</p>
        </div>
        <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--c4)] border border-[var(--c5)] flex items-center justify-center text-3xl">🧑</div>
            <div>
              <p className="text-[var(--ct0)] text-sm font-medium">Profile photo</p>
              <p className="text-[var(--ct1)] text-xs">From Google account</p>
            </div>
          </div>
          <div className="w-full h-px bg-[var(--c5)]" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide">First name</span>
              <input type="text" placeholder="First" value={firstName} onChange={e => handleFirstName(e.target.value)}
                className={`mt-1.5 w-full bg-[var(--c4)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border outline-none text-sm transition-colors focus:border-[#FACC15] ${touched && !firstName.trim() ? 'border-[#EF4444]' : 'border-[var(--c5)]'}`} />
            </label>
            <label className="block">
              <span className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide">Last name</span>
              <input type="text" placeholder="Last" value={lastName} onChange={e => handleLastName(e.target.value)}
                className="mt-1.5 w-full bg-[var(--c4)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border border-[var(--c5)] focus:border-[#FACC15] outline-none text-sm transition-colors" />
            </label>
          </div>
          <label className="block">
            <span className="text-[var(--ct1)] text-xs font-medium uppercase tracking-wide">Display name</span>
            <p className="text-[var(--ct2)] text-xs mt-0.5 mb-1.5">This is how you'll appear to teammates — feel free to use a nickname or whatever fits you best.</p>
            <input type="text" placeholder="How you appear to teammates" value={name} onChange={e => setName(e.target.value)}
              className={`w-full bg-[var(--c4)] text-[var(--ct0)] placeholder-[var(--ct2)] rounded-xl px-4 py-3 border outline-none text-sm transition-colors focus:border-[#FACC15] ${touched && !name.trim() ? 'border-[#EF4444]' : 'border-[var(--c5)]'}`} />
          </label>
        </div>

        {/* Team CTAs */}
        <div className="flex flex-col gap-2">
          {createdTeam ? (
            /* Success state — team was created */
            <div className="w-full bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#22C55E]/20 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#22C55E] text-sm font-semibold">Team created!</p>
                <p className="text-[var(--ct2)] text-xs mt-0.5 truncate">
                  <span className="text-[var(--ct1)] font-medium">{createdTeam.name}</span>
                  <span className="mx-1.5">·</span>
                  Code: <span className="text-[var(--ct0)] font-bold tracking-widest">{createdTeam.code}</span>
                </p>
              </div>
              <button
                onClick={() => { setCreatedTeam(null); setShowTeamSheet(true); }}
                className="text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTeamSheet(true)}
              className="w-full flex items-center gap-3 bg-[var(--c2)] border border-[var(--c5)] hover:border-[var(--ca)]/60 rounded-2xl p-4 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--ca)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--ca)]/20 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ca)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-[var(--ct0)] text-sm font-semibold">Create a team</p>
                <p className="text-[var(--ct2)] text-xs mt-0.5">Invite coworkers and track progress together</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ct2)" strokeWidth="2.5" strokeLinecap="round" className="shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}

          {joinedTeam ? (
            <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-xl">⏳</div>
              <div className="flex-1 min-w-0">
                <p className="text-amber-400 text-sm font-semibold">Request sent!</p>
                <p className="text-[var(--ct2)] text-xs mt-0.5 truncate">
                  <span className="text-[var(--ct1)] font-medium">{joinedTeam.name}</span>
                  <span className="mx-1.5">·</span>
                  Waiting for admin approval
                </p>
              </div>
              <button
                onClick={() => { setJoinedTeam(null); setShowJoinSheet(true); }}
                className="text-[var(--ct2)] text-xs hover:text-[var(--ct1)] transition-colors shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowJoinSheet(true)}
              className="w-full flex items-center gap-3 bg-[var(--c2)] border border-[var(--c5)] hover:border-[#22C55E]/40 rounded-2xl p-4 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 flex items-center justify-center text-xl shrink-0 group-hover:bg-[#22C55E]/20 transition-colors">
                🔗
              </div>
              <div className="flex-1 text-left">
                <p className="text-[var(--ct0)] text-sm font-semibold">Join a team</p>
                <p className="text-[var(--ct2)] text-xs mt-0.5">Enter an invite code to join your crew</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ct2)" strokeWidth="2.5" strokeLinecap="round" className="shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
        </div>

        {touched && !canProceed && (
          <p className="text-[#EF4444] text-xs text-center -mt-1">Please enter your first name and display name to continue.</p>
        )}
        <Button variant="primary" size="lg" className="w-full" onClick={() => {
          setTouched(true);
          if (canProceed) onFinish(name, firstName, lastName);
        }}>Let's go →</Button>
        <StepDots total={7} current={6} />
      </Screen>

      {showTeamSheet && (
        <TeamSheet
          onClose={() => setShowTeamSheet(false)}
          onTeamCreated={(n, c, org) => { setCreatedTeam({ name: n, code: c }); onTeamCreated(n, c, org); setShowTeamSheet(false); }}
        />
      )}
      {showJoinSheet && (
        <JoinTeamSheet
          onClose={() => setShowJoinSheet(false)}
          onJoined={team => { setJoinedTeam(team); onTeamJoined(team); setShowJoinSheet(false); }}
        />
      )}
    </>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
type SubStep = 'choice' | 'assess-reps' | 'assess-result' | 'manual';

export function OnboardingWizard({ onComplete, isReturningUser = false }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [subStep, setSubStep] = useState<SubStep>('choice');
  const { data: session, status } = useSession();

  // Only jump to step 6 when returning from our specific OAuth flow.
  // We detect this via ?onboarding=1 in the callbackUrl, so a regular
  // signed-in visitor doesn't get skipped past the welcome screen.
  useEffect(() => {
    if (status === 'authenticated') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('onboarding') === '1') {
        setStep(6);
        window.history.replaceState({}, '', '/');
      }
    }
  }, [status]);

  const [fitnessLevel, setFitnessLevel] = useState<ExperienceLevel>('beginner');
  const [assessReps, setAssessReps] = useState(0);
  const [enabledExercises, setEnabledExercises] = useState<EnabledExercises>(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem('ob_exercise_draft') ?? 'null');
      if (draft?.enabledExercises) return draft.enabledExercises;
    } catch {}
    return { pushups: true, squats: true, situps: true };
  });
  const [customExerciseLabels, setCustomExerciseLabels] = useState<Record<string, string>>(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem('ob_exercise_draft') ?? 'null');
      if (draft?.customExerciseLabels) return draft.customExerciseLabels;
    } catch {}
    return {};
  });
  const [customExerciseTrackingTypes, setCustomExerciseTrackingTypes] = useState<Record<string, 'reps' | 'time'>>(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem('ob_exercise_draft') ?? 'null');
      if (draft?.customExerciseTrackingTypes) return draft.customExerciseTrackingTypes;
    } catch {}
    return {};
  });
  const [createdTeamName, setCreatedTeamName] = useState('');
  const [createdTeamCode, setCreatedTeamCode] = useState('');
  const [createdTeamOrg,  setCreatedTeamOrg]  = useState('');
  const [joinedTeam,      setJoinedTeam]      = useState<Team | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('ob_exercise_draft', JSON.stringify({ enabledExercises, customExerciseLabels, customExerciseTrackingTypes }));
    } catch {}
  }, [enabledExercises, customExerciseLabels, customExerciseTrackingTypes]);

  const toggleExercise = (key: string) => {
    setEnabledExercises(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addCustomExercise = (label: string, trackingType: 'reps' | 'time' = 'reps') => {
    const key = `custom_${Date.now()}`;
    setCustomExerciseLabels(prev => ({ ...prev, [key]: label }));
    setEnabledExercises(prev => ({ ...prev, [key]: true }));
    setCustomExerciseTrackingTypes(prev => ({ ...prev, [key]: trackingType }));
  };

  const removeCustomExercise = (key: string) => {
    setCustomExerciseLabels(prev => { const next = { ...prev }; delete next[key]; return next; });
    setEnabledExercises(prev => { const next = { ...prev }; delete next[key]; return next; });
    setCustomExerciseTrackingTypes(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  const finish = async (profileName = '', firstName = '', lastName = '') => {
    try { sessionStorage.removeItem('ob_exercise_draft'); } catch {}
    const teamId = createdTeamName && createdTeamCode ? 'team-' + Date.now() : '';
    const adminName = `${firstName} ${lastName}`.trim() || profileName || 'Admin';

    const teams: Team[] = [];
    if (createdTeamName && createdTeamCode) {
      teams.push({
        id:       teamId,
        name:     createdTeamName,
        code:     createdTeamCode,
        isAdmin:  true,
        members:  [{ id: 'admin-' + Date.now(), displayName: adminName, role: 'admin' as const, joinedAt: Date.now() }],
        joinedAt: Date.now(),
      });
    }
    if (joinedTeam) {
      teams.push(joinedTeam);
    }

    // Persist profile to localStorage so SettingsForm reflects it immediately.
    try {
      const existing = JSON.parse(localStorage.getItem('puh_profile') ?? 'null') ?? {};
      localStorage.setItem('puh_profile', JSON.stringify({
        ...existing,
        ...(profileName && { displayName: profileName }),
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(createdTeamName && { team: createdTeamName }),
      }));
    } catch {}

    // Persist profile to Supabase
    const email = getEmail(session?.user?.email);
    if (email) {
      await supabase.from('profiles').upsert({
        email,
        first_name:   firstName        || null,
        last_name:    lastName         || null,
        display_name: profileName      || null,
        avatar_url:   (session?.user as any)?.image || null,
        team:         createdTeamName  || null,
      });
    }

    // Save team created during onboarding to Supabase
    if (teamId && createdTeamName && createdTeamCode) {
      await supabase.from('teams').upsert({
        id:           teamId,
        name:         createdTeamName,
        code:         createdTeamCode,
        admin_name:   adminName,
        organization: createdTeamOrg || null,
      });
    }

    onComplete({
      experienceLevel: fitnessLevel,
      enabledExercises,
      customExerciseLabels,
      customExerciseTrackingTypes,
      teams,
      reminders: {
        scheduleMode: 'auto',
        startHour: 9, startMinute: 0,
        endHour: 17,  endMinute: 0,
        customMinutes: [],
        enabled: true,
        snoozeMinutes: 10,
        alertStyle: 'sound',
      },
      progression: { ...PRESETS[fitnessLevel] } as AppSettings['progression'],
      startDate: new Date().toISOString().split('T')[0],
      onboardingComplete: true,
    });
  };

  // Step 2: workout selection
  if (step === 2) {
    return (
      <WorkoutSelectScreen
        selected={enabledExercises}
        customLabels={customExerciseLabels}
        customTrackingTypes={customExerciseTrackingTypes}
        onToggle={toggleExercise}
        onAddCustom={addCustomExercise}
        onRemoveCustom={removeCustomExercise}
        onNext={() => setStep(3)}
        onBack={() => setStep(1)}
      />
    );
  }

  // Step 3 is the branching fitness step — render sub-screens inline
  if (step === 3) {
    if (subStep === 'choice') {
      return (
        <StartingPointScreen
          onAssessment={() => setSubStep('assess-reps')}
          onManual={() => setSubStep('manual')}
          onBack={() => setStep(2)}
        />
      );
    }
    if (subStep === 'assess-reps') {
      return (
        <AssessmentRepsScreen
          onNext={reps => {
            setAssessReps(reps);
            setFitnessLevel(calcLevelFromReps(reps));
            setSubStep('assess-result');
          }}
          onBack={() => setSubStep('choice')}
        />
      );
    }
    if (subStep === 'assess-result') {
      return (
        <AssessmentResultScreen
          reps={assessReps}
          level={fitnessLevel}
          onNext={() => setStep(4)}
          onBack={() => setSubStep('assess-reps')}
        />
      );
    }
    if (subStep === 'manual') {
      return (
        <ManualLevelScreen
          selected={fitnessLevel}
          onSelect={setFitnessLevel}
          onNext={() => setStep(4)}
          onBack={() => setSubStep('choice')}
        />
      );
    }
  }

  const handleLogin = () => {
    onComplete({ onboardingComplete: true });
  };

  return (
    <>
      {step === 0 && (
        <WelcomeScreen
          onNext={() => setStep(1)}
          onLogin={handleLogin}
          isReturningUser={isReturningUser}
        />
      )}
      {step === 1 && <HowItWorksScreen    onNext={() => setStep(2)} onSkip={() => setStep(2)} />}
      {step === 4 && <NotificationsScreen onNext={() => setStep(5)} onSkip={() => setStep(5)} onBack={() => setStep(3)} />}
      {step === 5 && <SignInScreen        onNext={() => setStep(6)} onBack={() => setStep(4)} />}
      {step === 6 && <ProfileScreen onFinish={(dn, fn, ln) => finish(dn, fn, ln)} onBack={() => setStep(5)} onTeamCreated={(name, code, org) => { setCreatedTeamName(name); setCreatedTeamCode(code); setCreatedTeamOrg(org); }} onTeamJoined={team => setJoinedTeam(team)} />}
    </>
  );
}
