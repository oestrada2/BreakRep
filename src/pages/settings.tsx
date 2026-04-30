import { useAppState } from '@/hooks/useAppState';
import { NavTabs } from '@/components/layout/NavTabs';
import { SettingsForm } from '@/components/settings/SettingsForm';
import type { AppSettings } from '@/types';
import { useRouter } from 'next/router';
import { signOut } from 'next-auth/react';
import { clearAll } from '@/lib/storage';

export default function Settings() {
  const router = useRouter();
  const { settings, updateSettings, resetProgress, testNotification } = useAppState();

  return (
    <div className="min-h-screen bg-[var(--c0)] text-[var(--ct0)] font-sans pb-20">
      <header className="sticky top-0 z-50 bg-[var(--c0)]/95 backdrop-blur border-b border-[var(--c2)] px-4 pt-4 pb-3">
        <h1 className="text-[var(--ct0)] text-xl font-bold">Settings</h1>
        <p className="text-[var(--ct2)] text-xs mt-0.5">Profile, plan, reminders, and preferences</p>
      </header>
      <main className="max-w-lg mx-auto px-4 pt-4">
        {/* DEV ONLY — remove before launch */}
        <button
          onClick={() => {
            updateSettings({ onboardingComplete: false });
            router.push('/');
          }}
          className="w-full mb-4 py-2.5 rounded-xl border border-dashed border-[#FACC15]/40 text-[#FACC15] text-xs font-semibold hover:bg-[#FACC15]/10 transition-colors"
        >
          🛠 Restart Onboarding (dev)
        </button>
        <SettingsForm
          settings={settings}
          onChange={partial => updateSettings(partial as Partial<AppSettings>)}
          onReset={() => { resetProgress(); router.push('/'); }}
          onDeleteAccount={async () => {
            await fetch('/api/delete-account', { method: 'DELETE' }).catch(() => {});
            clearAll();
            resetProgress();
            router.push('/');
          }}
          onTestNotification={testNotification}
          onSignOut={() => signOut({ callbackUrl: '/login' })}
        />
      </main>
      <NavTabs />
    </div>
  );
}
