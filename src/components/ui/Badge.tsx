type BadgeVariant = 'completed' | 'missed' | 'skipped' | 'snoozed' | 'pending';

const COLORS: Record<BadgeVariant, string> = {
  completed: 'bg-[#22C55E]/20 text-[#22C55E]',
  missed:    'bg-[#EF4444]/20 text-[#EF4444]',
  skipped:   'bg-[#FB923C]/20 text-[#FB923C]',
  snoozed:   'bg-[#FACC15]/20 text-[#FACC15]',
  pending:   'bg-[var(--c5)] text-[var(--ct1)]',
};

export function Badge({ status }: { status: BadgeVariant }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${COLORS[status]}`}>
      {status}
    </span>
  );
}
