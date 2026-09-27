'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, LEVEL_NAMES, Select } from '@/components/ui';
import { api, apiUpload, openFile } from '@/lib/api';
import { type Claim, claimStatus, type Competency, EVIDENCE_LABELS, type EvidenceType, type Profile } from '@/lib/profile';
import { useSubmit } from '@/lib/useSubmit';

// A trainer's competency claims: what drives their fit score in trainer matching.
export function ClaimsSection({ profile, competencies, onChanged }: { profile: Profile; competencies: Competency[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Claim | 'new' | null>(null);
  const del = useSubmit();

  return (
    <Card
      title="Competency claims"
      description="Claims decide how you rank for each subject. Verified certificates and qualifications count fully (1.0), work experience and teaching 0.8, self-declared 0.5."
      action={editing === null && <Button variant="secondary" onClick={() => setEditing('new')}>Add claim</Button>}
    >
      {editing && (
        <ClaimForm
          key={editing === 'new' ? 'new' : editing.id}
          claim={editing === 'new' ? null : editing}
          profile={profile}
          competencies={competencies}
          onDone={(changed) => {
            setEditing(null);
            if (changed) onChanged();
          }}
        />
      )}

      {profile.claims.length === 0 ? (
        <EmptyState>No claims yet. Add the competencies you can teach.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {profile.claims.map((c) => {
            const status = claimStatus(c);
            const doc = c.certificate?.title ?? (c.qualification && `${c.qualification.degree} ${c.qualification.fieldOfStudy}`);
            return (
              <li key={c.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {c.competency.name} · L{c.level} {LEVEL_NAMES[c.level]}
                  </p>
                  <p className="text-sm text-slate-600">
                    {EVIDENCE_LABELS[c.evidenceType]}
                    {doc && `: ${doc}`}
                  </p>
                  {c.evidenceNote && <p className="text-xs italic text-slate-500">“{c.evidenceNote}”</p>}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Badge>trust {status.trust}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.hasEvidenceFile && (
                    <Button variant="secondary" onClick={() => openFile(`/api/claims/${c.id}/evidence`)}>Evidence</Button>
                  )}
                  <Button variant="secondary" onClick={() => setEditing(c)}>Edit</Button>
                  <Button
                    variant="danger"
                    disabled={del.busy}
                    onClick={async () => (await del.run(() => api(`/api/me/claims/${c.competency.id}`, { method: 'DELETE' }))) && onChanged()}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {del.error && <div className="mt-3"><Alert>{del.error}</Alert></div>}
    </Card>
  );
}

function ClaimForm({
  claim,
  profile,
  competencies,
  onDone,
}: {
  claim: Claim | null;
  profile: Profile;
  competencies: Competency[];
  onDone: (changed: boolean) => void;
}) {
  const [evidenceType, setEvidenceType] = useState<EvidenceType>(claim?.evidenceType ?? 'EXPERIENCE');
  const { busy, error, run } = useSubmit();
  const claimed = new Set(profile.claims.map((c) => c.competency.id));
  const usableCertificates = profile.certificates.filter((c) => c.status !== 'REJECTED');
  const usableQualifications = profile.qualifications.filter((q) => q.status !== 'REJECTED');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!(form.get('evidenceFile') as File | null)?.size) form.delete('evidenceFile');
    const ok = await run(() => apiUpload('/api/me/claims', form, 'PUT'));
    if (ok) onDone(true);
  }

  return (
    <form onSubmit={onSubmit} className="mb-5 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
      {claim && (
        <div className="sm:col-span-2">
          <Alert tone="amber">Saving changes sends this claim back for admin review if it uses a certificate or qualification.</Alert>
        </div>
      )}
      <Field label="Competency">
        {claim ? (
          <>
            <input type="hidden" name="competencyId" value={claim.competency.id} />
            <Input value={claim.competency.name} disabled />
          </>
        ) : (
          <Select name="competencyId" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {competencies
              .filter((c) => !claimed.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </Select>
        )}
      </Field>
      <Field label="Your level">
        <Select name="level" defaultValue={claim?.level ?? 3}>
          {[1, 2, 3, 4].map((l) => (
            <option key={l} value={l}>L{l} {LEVEL_NAMES[l]}</option>
          ))}
        </Select>
      </Field>
      <Field label="Evidence">
        <Select name="evidenceType" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}>
          {(Object.keys(EVIDENCE_LABELS) as EvidenceType[]).map((t) => (
            <option key={t} value={t}>{EVIDENCE_LABELS[t]}</option>
          ))}
        </Select>
      </Field>

      {evidenceType === 'CERTIFICATE' && (
        <Field label="Which certificate?" hint={usableCertificates.length ? undefined : 'Upload the certificate in the Certificates section first'}>
          <Select name="certificateId" required defaultValue={claim?.certificate?.id ?? ''}>
            <option value="" disabled>Choose…</option>
            {usableCertificates.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
        </Field>
      )}
      {evidenceType === 'QUALIFICATION' && (
        <Field label="Which qualification?" hint={usableQualifications.length ? undefined : 'Add the qualification in the Qualifications section first'}>
          <Select name="qualificationId" required defaultValue={claim?.qualification?.id ?? ''}>
            <option value="" disabled>Choose…</option>
            {usableQualifications.map((q) => (
              <option key={q.id} value={q.id}>{q.degree} {q.fieldOfStudy}</option>
            ))}
          </Select>
        </Field>
      )}

      <div className="sm:col-span-2">
        <Field label="Evidence note" hint="What backs this claim, e.g. “Ran DWR Mumbai 2019-2023”">
          <Input name="evidenceNote" defaultValue={claim?.evidenceNote ?? ''} maxLength={500} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Supporting file (optional)" hint="PDF, PNG, JPG or DOCX, e.g. an appointment or course-completion letter">
          <Input name="evidenceFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" />
        </Field>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save claim'}</Button>
        <Button variant="secondary" onClick={() => onDone(false)}>Cancel</Button>
      </div>
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
    </form>
  );
}
