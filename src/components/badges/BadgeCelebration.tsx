import { useEffect, useState } from 'react';
import type { EarnedBadge } from '@/types';
import { getBadgeDef } from '@/lib/badges';

interface BadgeCelebrationProps {
  badges: EarnedBadge[];
  onDismiss: () => void;
}

export function BadgeCelebration({ badges, onDismiss }: BadgeCelebrationProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (badges.length === 0) return;
    setIndex(0);
    // Slight delay so the animation feels intentional
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [badges]);

  if (badges.length === 0 || !visible) return null;

  const badge = badges[index];
  const def = getBadgeDef(badge.id);
  if (!def) return null;

  const isLast = index === badges.length - 1;

  function next() {
    if (isLast) {
      setVisible(false);
      setTimeout(onDismiss, 300);
    } else {
      setIndex(i => i + 1);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={next}
    >
      <div
        className="relative max-w-xs w-full rounded-3xl p-8 flex flex-col items-center gap-5 text-center"
        style={{
          background: 'linear-gradient(135deg, #1a1a0a 0%, #0B1C2D 100%)',
          border: '2px solid #FACC15',
          boxShadow: '0 0 60px rgba(250,204,21,0.3)',
          animation: 'badgePop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Badge count indicator */}
        {badges.length > 1 && (
          <div className="flex gap-1 absolute top-4 right-4">
            {badges.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-[#FACC15]' : 'bg-[var(--c5)]'}`} />
            ))}
          </div>
        )}

        {/* Glow */}
        <div className="absolute inset-0 rounded-3xl" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(250,204,21,0.12) 0%, transparent 70%)' }} />

        {/* Badge emoji */}
        <div
          className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl relative z-10"
          style={{ background: 'rgba(250,204,21,0.15)', border: '2px solid rgba(250,204,21,0.4)' }}
        >
          {def.emoji}
        </div>

        <div className="relative z-10">
          <p className="text-[#FACC15] text-xs font-bold uppercase tracking-widest mb-1">Badge Unlocked</p>
          <h2 className="text-white text-2xl font-black mb-2">{def.name}</h2>
          <p className="text-[var(--ct2)] text-sm leading-relaxed">{def.description}</p>
        </div>

        <button
          onClick={next}
          className="relative z-10 w-full py-3 rounded-2xl font-bold text-sm transition-colors"
          style={{ background: '#FACC15', color: '#0B1C2D' }}
        >
          {isLast ? 'Awesome!' : `Next (${index + 1}/${badges.length})`}
        </button>
      </div>

      <style>{`
        @keyframes badgePop {
          0%   { transform: scale(0.7) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0);      opacity: 1; }
        }
      `}</style>
    </div>
  );
}
