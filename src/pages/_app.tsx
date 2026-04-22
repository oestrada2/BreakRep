import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { useEffect } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SessionProvider } from 'next-auth/react';

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const saved = localStorage.getItem('puh_theme');
    const valid = ['dark','light','midnight','ocean','forest','carbon','rose','nebula','bluegray'];
    if (saved && valid.includes(saved)) {
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  return (
    <SessionProvider session={session}>
      <ThemeProvider>
        <Component {...pageProps} />
      </ThemeProvider>
    </SessionProvider>
  );
}
