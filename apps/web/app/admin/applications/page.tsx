'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReviewActions } from '@/components/ReviewActions';
import { Alert, Badge, EmptyState, formatDate, LEVEL_NAMES, PageHeader, Spinner, Toast } from '@/components/ui';
import { api, ApiError, type User } from '@/lib/api';

interface Application {
  id: string;
  motivation: string;
  createdAt: string;
  user: User & {
    qualifications: { degree: string; fieldOfStudy: string; institution: string; status: string }[];
    experiences: { organisation: string; title: string; startDate: string; endDate: string | null }[];
    userCompetencies: { level: number; source: string; competency: { name: string } }[];
  };
}

const fetchPending = () => api<{ applications: Application[] }>('/api/trainer-applications?status=PENDING');

export default function ApplicationsPage() {
  const [items, setItems] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);

  const show = useCallback((d: { applications: Application[] }) => setItems(d.applications), []);
  const fail = useCallback((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load applications'), []);
  useEffect(() => {
    fetchPending().then(show).catch(fail);
  }, [show, fail]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function review(a: Application, decision: 'APPROVE' | 'REJECT', reason?: string) {
    try {
      await api(`/api/trainer-applications/${a.id}/review`, { method: 'POST', body: { decision, reason } });
      setItems((list) => list?.filter((x) => x.id !== a.id) ?? null);
      setNotice({
        tone: 'green',
        text: decision === 'APPROVE' ? `${a.user.fullName} is now a trainer.` : `${a.user.fullName}'s application was rejected.`,
      });
    } catch (err) {
      setNotice({ tone: 'red', text: err instanceof ApiError ? err.message : 'Something went wrong' });
    }
  }

  return (
    <>
      <PageHeader title="Trainer applications" description="Trainees asking to become trainers. Approving changes their role to Trainer.">
        {items && <Badge tone={items.length ? 'amber' : 'green'}>{items.length} waiting</Badge>}
      </PageHeader>
      {notice && <Toast tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Toast>}
      {error && <Alert>{error}</Alert>}
      {!items && !error && <Spinner />}
      {items?.length === 0 && <EmptyState>No applications waiting.</EmptyState>}

      <ul className="space-y-3">
        {items?.map((a) => (
          <li key={a.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-3 text-sm">
                <div>
                  <p className="text-base font-semibold text-slate-900">{a.user.fullName}</p>
                  <p className="text-slate-600">
                    {[a.user.designation, a.user.institute?.name].filter(Boolean).join(' · ')} · applied {formatDate(a.createdAt)}
                  </p>
                </div>
                <p className="rounded-lg bg-slate-50 p-3 text-slate-700">“{a.motivation}”</p>
                {a.user.qualifications.length > 0 && (
                  <p className="text-slate-600">
                    <span className="font-medium text-slate-800">Qualifications:</span>{' '}
                    {a.user.qualifications.map((q) => `${q.degree} ${q.fieldOfStudy} (${q.institution})`).join('; ')}
                  </p>
                )}
                {a.user.experiences.length > 0 && (
                  <p className="text-slate-600">
                    <span className="font-medium text-slate-800">Experience:</span>{' '}
                    {a.user.experiences.map((x) => `${x.title}, ${x.organisation}`).join('; ')}
                  </p>
                )}
                {a.user.userCompetencies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {a.user.userCompetencies.map((s) => (
                      <Badge key={s.competency.name} tone={s.source === 'ASSESSMENT' ? 'green' : 'neutral'}>
                        {s.competency.name} · L{s.level} {LEVEL_NAMES[s.level]}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <ReviewActions approveLabel="Make trainer" onDecide={(d, reason) => review(a, d, reason)} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
