'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Badge, levelLabel, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { type BreakdownRow, evidenceLabel, pct, type Subject, type TrainerMatch } from '@/lib/matching';

export default function TrainerMatchesPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ subject: Subject; matches: TrainerMatch[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ subject: Subject; matches: TrainerMatch[] }>(`/api/subjects/${id}/trainer-matches`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load trainer matches'));
  }, [id]);

  return (
    <>
      <Link href="/admin/subjects" className="text-sm font-medium text-brand-600 hover:underline">
        ← All subjects
      </Link>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {!data && !error && <Spinner label="Ranking trainers…" />}

      {data && (
        <>
          <div className="mt-3">
            <PageHeader title={data.subject.name} description={data.subject.description} />
          </div>

          <HowScoringWorks subject={data.subject} />

          <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {data.matches.length} trainers ranked
          </h2>
          <ol className="space-y-3">
            {data.matches.map((match) => (
              <TrainerCard key={match.trainer.id} match={match} />
            ))}
          </ol>
        </>
      )}
    </>
  );
}

function HowScoringWorks({ subject }: { subject: Subject }) {
  return (
    <details className="group rounded-xl bg-white p-4 text-sm ring-1 ring-slate-200">
      <summary className="cursor-pointer font-semibold text-slate-800 marker:text-slate-400">
        How the fit score is calculated
      </summary>
      <div className="mt-3 space-y-3 text-slate-600">
        <p>For each required competency:</p>
        <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
          coverage = min(trainer level ÷ required level, 1) × evidence trust
        </p>
        <p>
          Evidence trust: verified certificate or qualification <b>1.0</b>, work experience or teaching record{' '}
          <b>0.8</b>, self-declared or unverified document <b>0.5</b>, no claim <b>0</b>.
        </p>
        <p>
          <b>Fit score</b> = sum of (weight × coverage). A trainer with <i>no claim at all</i> for a required
          competency is marked <b>partial fit</b>.
        </p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {subject.requirements.map((r) => (
            <li key={r.competency.id} className="flex justify-between gap-3 rounded-md bg-slate-50 px-3 py-1.5">
              <span>{r.competency.name}</span>
              <span className="shrink-0 text-slate-500">
                min L{r.minLevel} · weight {Math.round(r.weight * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function fitTone(match: TrainerMatch) {
  if (match.fitPercent >= 75) return 'bg-emerald-500';
  if (match.fitPercent >= 50) return 'bg-brand-600';
  if (match.fitPercent >= 25) return 'bg-amber-500';
  return 'bg-slate-400';
}

function TrainerCard({ match }: { match: TrainerMatch }) {
  const { trainer } = match;
  return (
    <li className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex gap-3 p-4 sm:gap-4 sm:p-5">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700"
          aria-label={`Rank ${match.rank}`}
        >
          {match.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{trainer.fullName}</p>
              <p className="text-sm text-slate-600">
                {[trainer.designation, trainer.institute?.code].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-slate-900">{match.fitPercent}%</p>
            </div>
          </div>

          {trainer.trainerProfile?.headline && (
            <p className="mt-1 text-sm text-slate-500">{trainer.trainerProfile.headline}</p>
          )}

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className={`h-full rounded-full ${fitTone(match)}`} style={{ width: `${match.fitPercent}%` }} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {match.partialFit ? (
              <Badge tone="amber">Partial fit · missing {match.missingCompetencies.join(', ')}</Badge>
            ) : (
              <Badge tone="green">Covers all requirements</Badge>
            )}
          </div>
        </div>
      </div>

      <details className="border-t border-slate-100">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-slate-50 sm:px-5">
          Why this trainer?
        </summary>
        <div className="px-4 pb-4 sm:px-5">
          <ul className="divide-y divide-slate-100">
            {match.breakdown.map((row) => (
              <BreakdownItem key={row.competencyId} row={row} />
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900">
            <span>Fit score (sum of points)</span>
            <span className="tabular-nums">{match.fitPercent}%</span>
          </p>
        </div>
      </details>
    </li>
  );
}

const statusBadge: Record<BreakdownRow['status'], { tone: 'green' | 'amber' | 'red'; label: string }> = {
  MEETS: { tone: 'green', label: 'Meets level' },
  BELOW_LEVEL: { tone: 'amber', label: 'Below required level' },
  MISSING: { tone: 'red', label: 'No claim' },
};

function BreakdownItem({ row }: { row: BreakdownRow }) {
  const status = statusBadge[row.status];
  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-slate-900">{row.competencyName}</p>
        <span className="tabular-nums text-slate-900">
          +{pct(row.contribution)} <span className="text-slate-400">of {pct(row.weight)}</span>
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Badge tone={status.tone}>{status.label}</Badge>
        {row.evidenceType && (
          <Badge tone={row.trust === 1 ? 'green' : row.trust >= 0.8 ? 'brand' : 'neutral'}>
            {evidenceLabel(row)} · trust {row.trust}
          </Badge>
        )}
      </div>

      <p className="mt-1.5 text-slate-600">
        Required {levelLabel(row.minLevel)}, has {levelLabel(row.claimedLevel)}
      </p>
      {row.status !== 'MISSING' && (
        // Shows the actual arithmetic, so every number on the page can be checked by hand.
        <p className="mt-0.5 font-mono text-xs text-slate-500">
          min({row.claimedLevel}/{row.minLevel}, 1) × {row.trust} = {row.coverage.toFixed(2)} coverage × {row.weight} weight
        </p>
      )}
      {row.evidenceNote && <p className="mt-1 text-xs italic text-slate-500">“{row.evidenceNote}”</p>}
    </li>
  );
}
