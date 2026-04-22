'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import type { DailyStats } from '@/types';

interface ComplianceChartProps {
  stats: DailyStats[];
  threshold?: number;
}

export function ComplianceChart({ stats, threshold = 0.6 }: ComplianceChartProps) {
  const data = [...stats]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map(s => ({
      date: s.date.slice(5),  // MM-DD
      compliance: Math.round(s.complianceRate * 100),
      fill: s.complianceRate >= threshold ? '#22C55E' : '#EF4444',
    }));

  return (
    <div className="bg-[var(--c4)] border border-[var(--c5)] rounded-lg p-4">
      <h2 className="text-[var(--ct0)] font-semibold text-sm uppercase tracking-wide mb-4">Compliance (14 days)</h2>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--c5)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--ct1)', fontSize: 10 }} />
          <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--ct1)', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: 'var(--c4)', border: '1px solid var(--c5)', borderRadius: 6 }}
            labelStyle={{ color: 'var(--ct0)' }}
            itemStyle={{ color: '#22C55E' }}
            formatter={(value: number) => [`${value}%`, 'Compliance']}
          />
          <ReferenceLine
            y={threshold * 100}
            stroke="#FACC15"
            strokeDasharray="4 2"
            label={{ value: 'target', fill: '#FACC15', fontSize: 10 }}
          />
          <Bar dataKey="compliance" radius={[3, 3, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
