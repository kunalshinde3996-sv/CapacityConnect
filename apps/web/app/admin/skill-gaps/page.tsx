'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, Card, levelLabel, PageHeader, Select, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

interface GapRow {
  competencyId: string;
  name: string;
  category: string;
  targetLevel: number;
  teachingBar: number;
  demand: number;
  met: number;
  notAssessed: number;
  supplyHere: number;
  supplyAll: number;
  perTrainer: number | null;
  noTrainer: boolean;
  subjects: { id: string; name: string }[];
}

interface SkillGaps {
  institutes: { id: string; code: string; name: string }[];
  institute: { code: string; name: string } | null;
  trainees: number;
  rows: GapRow[];
}

// Links from a gap to trainer matching for the subject(s) that need the competency.
function MatchLinks({ row }: { row: GapRow }) {
  if (row.subjects.length === 0) return <span className="text-xs text-slate-600">No subject requires this yet</span>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {row.subjects.map((s) => (
        <Link key={s.id} href={`/admin/subjects/${s.id}/trainers`} className="text-sm font-semibold text-brand-700 hover:underline">
          Find trainers: {s.name} →
        </Link>
      ))}
    </span>
  );
}

function Supply({ row, filtered }: { row: GapRow; filtered: boolean }) {
  if (row.supplyAll === 0) return <Badge tone="red">No qualified trainer</Badge>;
  return (
    <span className="text-sm text-slate-700">
      {filtered && <>{row.supplyHere} at this station · </>}
      {row.supplyAll} across MoES
    </span>
  );
}

export default function SkillGapsPage() {
  const [institute, setInstitute] = useState('');
  const [data, setData] = useState<SkillGaps | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    api<SkillGaps>(`/api/skill-gaps${institute ? `?institute=${institute}` : ''}`)
      .then((d) => !stale && setData(d))
      .catch((err) => !stale && setError(err instanceof ApiError ? err.message : 'Could not load skill gaps'));
    return () => {
      stale = true;
    };
  }, [institute]);

  const filtered = Boolean(institute);
  const gaps = data?.rows.filter((r) => r.demand > 0) ?? [];
  const top = gaps.slice(0, 3);

  return (
    <>
      <PageHeader
        title="Skill gaps"
        description="Trainees below the target level (demand) against trainers qualified to teach it (supply), per competency."
      >
        <Select aria-label="Institute / station" value={institute} onChange={(e) => setInstitute(e.target.value)} className="mt-0 w-auto">
          <option value="">All institutes</option>
          {data?.institutes.map((i) => (
            <option key={i.code} value={i.code}>{i.name}</option>
          ))}
        </Select>
      </PageHeader>

      {error && <Alert>{error}</Alert>}
      {!data && !error && <Spinner />}

      {data && (
        <div className="space-y-6">
          <section aria-labelledby="biggest-gaps">
            <h2 id="biggest-gaps" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
              Biggest gaps {data.institute ? `at ${data.institute.name}` : 'across MoES'} · {data.trainees} trainees
            </h2>
            {top.length === 0 ? (
              <Alert tone="green">No trainee is below the target level here.</Alert>
            ) : (
              <ol className="grid gap-3 md:grid-cols-3">
                {top.map((r, i) => (
                  <li key={r.competencyId} className={`rounded-xl bg-white p-4 shadow-sm ring-2 ${i === 0 ? 'ring-red-300' : 'ring-amber-200'}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">#{i + 1} · {r.category.toLowerCase()}</p>
                    <p className="mt-1 font-semibold text-slate-900">{r.name}</p>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{r.demand}</p>
                    <p className="text-sm text-slate-700">trainees below {levelLabel(r.targetLevel)}</p>
                    <p className="mt-2"><Supply row={r} filtered={filtered} /></p>
                    {r.perTrainer !== null && <p className="text-sm text-slate-700">{r.perTrainer} trainees per qualified trainer</p>}
                    <div className="mt-3 border-t border-slate-100 pt-3"><MatchLinks row={r} /></div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <Card
            title="All competencies"
            description="Supply counts trainers at or above the teaching bar with trust 0.8 or more (verified documents, experience, teaching). Self-declared claims don't count."
          >
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Supply and demand per competency</caption>
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">Competency</th>
                    <th scope="col" className="px-3 py-2 font-medium">Target</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Below target</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">At target</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Not assessed</th>
                    <th scope="col" className="px-3 py-2 font-medium">Qualified trainers</th>
                    <th scope="col" className="py-2 pl-3 font-medium">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((r) => (
                    <tr key={r.competencyId} className={r.noTrainer ? 'bg-red-50/60' : undefined}>
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-900">{r.name}</th>
                      <td className="px-3 py-2 whitespace-nowrap">L{r.targetLevel}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.demand}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.met}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{r.notAssessed}</td>
                      <td className="px-3 py-2"><Supply row={r} filtered={filtered} /></td>
                      <td className="py-2 pl-3">{r.demand > 0 && <MatchLinks row={r} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone cards */}
            <ul className="space-y-3 md:hidden">
              {data.rows.map((r) => (
                <li key={r.competencyId} className={`rounded-lg p-3 ring-1 ${r.noTrainer ? 'bg-red-50/60 ring-red-200' : 'ring-slate-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <span className="text-sm text-slate-600">target L{r.targetLevel}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    <b className="tabular-nums">{r.demand}</b> below target · {r.met} at target · {r.notAssessed} not assessed
                  </p>
                  <p className="mt-1"><Supply row={r} filtered={filtered} /></p>
                  {r.demand > 0 && <div className="mt-2"><MatchLinks row={r} /></div>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
