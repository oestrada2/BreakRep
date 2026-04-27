import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') return null;

  return (
    <div className="min-h-screen bg-[var(--c0)] text-[var(--ct0)] font-sans flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo / brand */}
        <div>
          <div className="w-16 h-16 rounded-2xl bg-[#F97316]/10 flex items-center justify-center text-4xl mx-auto mb-4">🏋️</div>
          <h1 className="text-3xl font-black text-[var(--ct0)]">BreakRep</h1>
          <p className="text-[var(--ct2)] text-sm mt-1">Your micro-workout companion</p>
        </div>

        {/* Sign-in card */}
        <div className="bg-[var(--c2)] border border-[var(--c5)] rounded-2xl p-6 space-y-4">
          <p className="text-[var(--ct1)] text-sm">Sign in to track your progress and sync across devices.</p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white text-[#09090B] rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="text-[var(--ct2)] text-xs">By continuing you agree to our Terms of Service and Privacy Policy.</p>
      </div>
    </div>
  );
}
