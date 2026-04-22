/**
 * Notification Service — Capacitor-ready abstraction.
 *
 * HOW THIS WORKS NOW (browser):
 *   Registers a Service Worker (public/sw.js) that holds scheduled timers.
 *   Notifications fire even when the user has switched tabs, as long as the
 *   browser is open. The SW sends a message back to the page to trigger the
 *   alert sound / vibration.
 *
 * HOW TO WIRE IN CAPACITOR (production Android):
 *   1. `npm install @capacitor/local-notifications`
 *   2. Replace scheduleAll / sendImmediate below with the CAPACITOR SECTION.
 *   3. Remove the SW registration from _app.tsx.
 */

export interface ScheduledNotification {
  id: number;
  title: string;
  body: string;
  fireAt: Date;
  alertStyle?: string;
}

// ─── SERVICE WORKER REGISTRATION ─────────────────────────────────────────────

let _swReady: Promise<ServiceWorkerRegistration | null> | null = null;

function getSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  if (_swReady) return _swReady;
  _swReady = navigator.serviceWorker
    .register('/sw.js')
    .then(reg => {
      // Listen for alert messages from SW → play sound/vibrate in page context
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'ALERT') {
          triggerAlert((e.data.alertStyle as import('@/types').AlertStyle) ?? 'sound');
        }
      });
      return reg;
    })
    .catch(err => {
      console.warn('[SW] Registration failed:', err);
      return null;
    });
  return _swReady;
}

// ─── PERMISSION ───────────────────────────────────────────────────────────────

async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ─── SCHEDULE ────────────────────────────────────────────────────────────────

async function scheduleAll(notifications: ScheduledNotification[]): Promise<void> {
  const granted = await requestPermission();
  if (!granted) {
    console.warn('[Notifications] Permission denied.');
    return;
  }

  const reg = await getSW();
  if (reg?.active) {
    reg.active.postMessage({
      type: 'SCHEDULE',
      notifications: notifications.map(n => ({
        ...n,
        fireAt: n.fireAt.getTime(), // serialise Date → number for postMessage
      })),
    });
    return;
  }

  // Fallback: page-level setTimeout (lost on reload, but better than nothing)
  notifications.forEach(n => {
    const delay = n.fireAt.getTime() - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        new Notification(n.title, { body: n.body });
        triggerAlert((n.alertStyle as import('@/types').AlertStyle) ?? 'sound');
      }, delay);
    }
  });
}

async function cancelAll(): Promise<void> {
  const reg = await getSW();
  reg?.active?.postMessage({ type: 'CANCEL' });
}

async function sendImmediate(title: string, body: string): Promise<void> {
  const granted = await requestPermission();
  if (!granted) return;
  new Notification(title, { body });
}

// ─── ALERT: sound / vibrate / both ───────────────────────────────────────────

export type NotificationSound = import('@/types').NotificationSound;

export const NOTIFICATION_SOUNDS: { id: NotificationSound; label: string; description: string }[] = [
  { id: 'double-beep', label: 'Double Beep',  description: 'Two quick beeps'         },
  { id: 'chime',       label: 'Chime',        description: 'Gentle descending chime'  },
  { id: 'ping',        label: 'Ping',         description: 'Single sharp ping'        },
  { id: 'bell',        label: 'Bell',         description: 'Soft bell tone'           },
  { id: 'nudge',       label: 'Nudge',        description: 'Three soft pulses'        },
];

function tone(ctx: AudioContext, freq: number, start: number, duration: number, volume = 0.9, type: OscillatorType = 'sine') {
  const osc      = ctx.createOscillator();
  const gain     = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  osc.connect(gain);
  gain.connect(compressor);
  compressor.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
}

function playSound(sound: NotificationSound = 'double-beep'): void {
  try {
    const ctx = new AudioContext();
    switch (sound) {
      case 'double-beep':
        tone(ctx, 880, 0,    0.22, 3.0);
        tone(ctx, 880, 0.32, 0.22, 3.0);
        break;
      case 'chime':
        tone(ctx, 784, 0,    0.4, 3.0);  // G5
        tone(ctx, 659, 0.3,  0.4, 2.8);  // E5
        tone(ctx, 523, 0.6,  0.6, 2.8);  // C5
        break;
      case 'ping':
        tone(ctx, 1318, 0, 0.6, 3.0);    // E6 — single high ping
        break;
      case 'bell':
        tone(ctx, 523,  0, 1.0, 3.0);    // C5 fundamental
        tone(ctx, 1046, 0, 0.8, 1.5);    // C6 harmonic
        tone(ctx, 1568, 0, 0.6, 0.8);    // G6 harmonic
        break;
      case 'nudge':
        tone(ctx, 440, 0,    0.15, 3.0, 'triangle');
        tone(ctx, 440, 0.2,  0.15, 2.8, 'triangle');
        tone(ctx, 440, 0.4,  0.15, 2.6, 'triangle');
        break;
    }
  } catch {
    console.warn('[Notifications] Web Audio not available.');
  }
}

function triggerVibration(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate([300, 100, 300]);
  }
}

function triggerAlert(style: import('@/types').AlertStyle, sound?: NotificationSound): void {
  if (style === 'sound'   || style === 'both') playSound(sound);
  if (style === 'vibrate' || style === 'both') triggerVibration();
}

export const NotificationService = {
  requestPermission,
  scheduleAll,
  cancelAll,
  sendImmediate,
  triggerAlert,
  playSound,
  getSW,
};

// ─── HELPER: Build notification list from sessions ────────────────────────────

import type { SessionLog } from '@/types';
import { sessionFireTime } from '@/lib/sessions';

export function buildNotifications(
  sessions: SessionLog[],
  alertStyle?: string
): ScheduledNotification[] {
  return sessions
    .filter(s => s.status === 'pending')
    .map(s => {
      const fireAt = sessionFireTime(s.date, s.scheduledHour, s.scheduledMinute ?? 0);
      return {
        id: parseInt(s.id.replace(/-/g, '').replace(/^0+/, ''), 10) % 2_147_483_647,
        title: '💪 Push-up time!',
        body: `Time for push-ups: do ${s.targetReps} reps`,
        fireAt,
        alertStyle,
      };
    })
    .filter(n => n.fireAt > new Date());
}
