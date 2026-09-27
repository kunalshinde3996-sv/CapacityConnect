'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const BRAND = '#1d4ed8';
const GRID = '#e2e8f0';
const AXIS = { fontSize: 12, fill: '#475569' };

// Every chart comes with the same numbers as a small table, for screen readers and
// for anyone who wants exact values.
function DataTable({ caption, headers, rows }: { caption: string; headers: [string, string]; rows: [string, number][] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-slate-600 hover:text-slate-900">Show data</summary>
      <table className="mt-2 w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs uppercase text-slate-500">
          <tr><th className="py-1 font-medium">{headers[0]}</th><th className="py-1 text-right font-medium">{headers[1]}</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([label, value]) => (
            <tr key={label}><td className="py-1">{label}</td><td className="py-1 text-right tabular-nums">{value}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function HorizontalBars({ data, label, value, caption }: { data: Record<string, string | number>[]; label: string; value: string; caption: string }) {
  return (
    <div>
      <div style={{ height: Math.max(160, data.length * 40) }} role="img" aria-label={caption}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS} />
            <YAxis type="category" dataKey={label} width={150} tick={AXIS} tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey={value} fill={BRAND} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={caption} headers={[label, value]} rows={data.map((d) => [String(d[label]), Number(d[value])])} />
    </div>
  );
}

export function WeeklyLine({ data, caption }: { data: { weekStarting: string; submissions: number }[]; caption: string }) {
  const rows = data.map((d) => ({ ...d, week: new Date(d.weekStarting).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }));
  return (
    <div>
      <div className="h-56" role="img" aria-label={caption}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: 0, right: 16, top: 8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="week" tick={AXIS} />
            <YAxis allowDecimals={false} tick={AXIS} width={32} />
            <Tooltip />
            <Line type="monotone" dataKey="submissions" stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={caption} headers={['Week starting', 'Submissions']} rows={rows.map((r) => [r.week, r.submissions])} />
    </div>
  );
}
