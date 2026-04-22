import { useAppState } from '@/hooks/useAppState';
import { NavTabs } from '@/components/layout/NavTabs';
import { SettingsForm } from '@/components/settings/SettingsForm';
import type { AppSettings } from '@/types';
import { useRouter } from 'next/router';

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
        <SettingsForm
          settings={settings}
          onChange={partial => updateSettings(partial as Partial<AppSettings>)}
          onReset={() => { resetProgress(); router.push('/'); }}
          onTestNotification={testNotification}
        />
      </main>
      <NavTabs />
    </div>
  );
}
