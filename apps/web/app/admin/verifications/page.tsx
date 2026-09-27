'use client';

import { useCallback, useEffect, useState } from 'react';
import { ReviewActions } from '@/components/ReviewActions';
import { Alert, Badge, Button, EmptyState, formatDate, LEVEL_NAMES, PageHeader, Spinner, Toast } from '@/components/ui';
import { api, ApiError, openFile } from '@/lib/api';
import { EVIDENCE_LABELS, type EvidenceType } from '@/lib/profile';

interface Owner {
  id: string;
  fullName: string;
  email: string;
  role: string;
  institute: { code: string } | null;
}

interface QueueClaim {
  id: string;
  level: number;
  evidenceType: EvidenceType;
  evidenceNote: string | null;
  hasEvidenceFile: boolean;
  user: Owner;
  competency: { name: string };
  certificate: { id: string; title: string; issuer: string; issuedOn: string | null; hasFile: boolean } | null;
  qualification: { id: string; degree: string; fieldOfStudy: string; institution: string; yearCompleted: number | null; hasFile: boolean } | null;
}

type QueueDocument =
  | { kind: 'CERTIFICATE'; id: string; title: string; issuer: string; issuedOn: string | null; hasFile: boolean; user: Owner; createdAt: string }
  | { kind: 'QUALIFICATION'; id: string; degree: string; fieldOfStudy: string; institution: string; yearCompleted: number | null; hasFile: boolean; user: Owner; createdAt: string };

interface Queue {
  claims: QueueClaim[];
  documents: QueueDocument[];
}

const fetchQueue = () => api<Queue>('/api/verifications');

export default function VerificationsPage() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);

  const show = useCallback((q: Queue) => setQueue(q), []);
  const fail = useCallback((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the queue'), []);
  useEffect(() => {
    fetchQueue().then(show).catch(fail);
  }, [show, fail]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function review(path: string, label: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
    try {
      await api(path, { method: 'POST', body: { decision, reason } });
      setNotice({ tone: 'green', text: `${label} ${decision === 'APPROVE' ? 'verified' : 'rejected'}.` });
    } catch (err) {
      setNotice({ tone: 'red', text: err instanceof ApiError ? err.message : 'Something went wrong' });
    }
    fetchQueue().then(show).catch(fail);
  }

  const view = (endpoint: string) => openFile(endpoint).catch(() => setNotice({ tone: 'red', text: 'Could not open the file' }));

  return (
    <>
      <PageHeader title="Verifications" description="Verified evidence counts fully in trainer matching (trust 1.0). Check each document before approving.">
        {queue && <Badge tone={queue.claims.length + queue.documents.length ? 'amber' : 'green'}>{queue.claims.length + queue.documents.length} waiting</Badge>}
      </PageHeader>
      {notice && <Toast tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Toast>}
      {error && <Alert>{error}</Alert>}
      {!queue && !error && <Spinner />}

      {queue && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Trainer claims ({queue.claims.length})</h2>
            {queue.claims.length === 0 ? (
              <EmptyState>No trainer claims waiting.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {queue.claims.map((c) => {
                  const doc = c.certificate
                    ? { label: `${c.certificate.title} · ${c.certificate.issuer}`, file: c.certificate.hasFile && `/api/documents/certificates/${c.certificate.id}/file` }
                    : c.qualification
                      ? { label: `${c.qualification.degree} ${c.qualification.fieldOfStudy} · ${c.qualification.institution}`, file: c.qualification.hasFile && `/api/documents/qualifications/${c.qualification.id}/file` }
                      : null;
                  return (
                    <li key={c.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1 text-sm">
                          <p className="text-base font-semibold text-slate-900">
                            {c.competency.name} · L{c.level} {LEVEL_NAMES[c.level]}
                          </p>
                          <p className="text-slate-600">
                            {c.user.fullName} · {c.user.institute?.code ?? 'No institute'}
                          </p>
                          <p>
                            <span className="text-slate-500">{EVIDENCE_LABELS[c.evidenceType]}:</span> {doc?.label ?? 'missing'}
                          </p>
                          {c.evidenceNote && <p className="italic text-slate-500">“{c.evidenceNote}”</p>}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {doc?.file && <Button variant="secondary" className="min-h-8 px-3" onClick={() => view(doc.file as string)}>View document</Button>}
                            {c.hasEvidenceFile && <Button variant="secondary" className="min-h-8 px-3" onClick={() => view(`/api/claims/${c.id}/evidence`)}>Supporting file</Button>}
                          </div>
                        </div>
                        <ReviewActions
                          approveLabel="Verify claim"
                          onDecide={(d, reason) => review(`/api/verifications/claims/${c.id}`, `${c.user.fullName}'s ${c.competency.name} claim`, d, reason)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Other documents ({queue.documents.length})</h2>
            {queue.documents.length === 0 ? (
              <EmptyState>No certificates or qualifications waiting.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {queue.documents.map((d) => {
                  const isCert = d.kind === 'CERTIFICATE';
                  const title = isCert ? d.title : `${d.degree} ${d.fieldOfStudy}`;
                  const detail = isCert ? `${d.issuer}${d.issuedOn ? ` · ${formatDate(d.issuedOn)}` : ''}` : `${d.institution}${d.yearCompleted ? ` · ${d.yearCompleted}` : ''}`;
                  const kindPath = isCert ? 'certificates' : 'qualifications';
                  return (
                    <li key={d.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-slate-900">{title}</p>
                            <Badge>{isCert ? 'Certificate' : 'Qualification'}</Badge>
                          </div>
                          <p className="text-slate-600">{detail}</p>
                          <p className="text-slate-600">
                            {d.user.fullName} ({d.user.role.toLowerCase()}) · {d.user.institute?.code ?? 'No institute'}
                          </p>
                          {d.hasFile ? (
                            <Button variant="secondary" className="mt-1 min-h-8 px-3" onClick={() => view(`/api/documents/${kindPath}/${d.id}/file`)}>View document</Button>
                          ) : (
                            <p className="text-xs text-amber-700">No file attached</p>
                          )}
                        </div>
                        <ReviewActions onDecide={(dec, reason) => review(`/api/verifications/${kindPath}/${d.id}`, title, dec, reason)} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
