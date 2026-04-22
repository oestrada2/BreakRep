import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'complete' | 'snooze' | 'skip' | 'destructive' | 'secondary' | 'ghost' | 'primary' | 'outline';

const VARIANTS: Record<Variant, string> = {
  primary:     'bg-[#FACC15] hover:bg-[#EAB308] active:bg-[#CA8A04] text-[#0B1C2D] font-bold',
  complete:    'bg-[#22C55E] hover:bg-[#16A34A] active:bg-[#15803D] text-white',
  snooze:      'bg-[#FACC15] hover:bg-[#EAB308] active:bg-[#CA8A04] text-black',
  skip:        'bg-[#FB923C] hover:bg-[#EA580C] active:bg-[#C2410C] text-white',
  destructive: 'bg-[#EF4444] hover:bg-[#DC2626] active:bg-[#B91C1C] text-white',
  secondary:   'bg-[var(--ca)] hover:bg-[#0EA5E9] active:bg-[#0284C7] text-black',
  outline:     'bg-transparent border border-[var(--ca)] hover:bg-[var(--ca)]/10 text-[var(--ca)]',
  ghost:       'bg-transparent border border-[var(--c5)] hover:bg-[var(--c5)] text-[var(--ct1)]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'ghost', size = 'md', className, ...props }: ButtonProps) {
  const sizes = { sm: 'px-3 py-1 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3.5 text-base' };
  return (
    <button
      className={cn(
        'rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
