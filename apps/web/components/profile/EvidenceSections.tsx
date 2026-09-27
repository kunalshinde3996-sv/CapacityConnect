'use client';

import { useRef, useState } from 'react';
import { Alert, Button, Card, EmptyState, Field, formatDate, Input, VerificationBadge } from '@/components/ui';
import { api, apiUpload, openFile } from '@/lib/api';
import type { Profile } from '@/lib/profile';
import { useSubmit } from '@/lib/useSubmit';

const FILE_HINT = 'PDF, PNG or JPG';

// ── Certificates ──────────────────────────────────────────

export function CertificatesSection({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { busy, error, run } = useSubmit();
  const del = useSubmit();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = await run(() => apiUpload('/api/me/certificates', new FormData(e.currentTarget)));
    if (ok) {
      formRef.current?.reset();
      setOpen(false);
      onChanged();
    }
  }

  return (
    <Card
      title="Certificates"
      description="Upload training certificates. An admin checks each one before it counts as verified evidence."
      action={!open && <Button variant="secondary" onClick={() => setOpen(true)}>Upload certificate</Button>}
    >
      {open && (
        <form ref={formRef} onSubmit={onSubmit} className="mb-5 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
          <Field label="Title">
            <Input name="title" required maxLength={150} placeholder="e.g. Advanced Radar Meteorology" />
          </Field>
          <Field label="Issued by">
            <Input name="issuer" required maxLength={150} placeholder="e.g. WMO Regional Training Centre" />
          </Field>
          <Field label="Issued on">
            <Input name="issuedOn" type="date" />
          </Field>
          <Field label="Certificate file" hint={FILE_HINT}>
            <Input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg" required />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
        </form>
      )}

      {profile.certificates.length === 0 ? (
        <EmptyState>No certificates uploaded yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {profile.certificates.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{c.title}</p>
                <p className="text-sm text-slate-600">
                  {c.issuer}
                  {c.issuedOn && ` · ${formatDate(c.issuedOn)}`}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <VerificationBadge status={c.status} />
                  {c.rejectionReason && <span className="text-xs text-red-700">{c.rejectionReason}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {c.hasFile && (
                  <Button variant="secondary" onClick={() => openFile(`/api/documents/certificates/${c.id}/file`)}>View</Button>
                )}
                {c.status !== 'VERIFIED' && (
                  <Button
                    variant="danger"
                    disabled={del.busy}
                    onClick={async () => (await del.run(() => api(`/api/me/certificates/${c.id}`, { method: 'DELETE' }))) && onChanged()}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {del.error && <div className="mt-3"><Alert>{del.error}</Alert></div>}
    </Card>
  );
}

// ── Qualifications ────────────────────────────────────────

export function QualificationsSection({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useSubmit();
  const del = useSubmit();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    // An empty file input still sends an empty part; drop it so the file stays optional.
    if (!(form.get('file') as File | null)?.size) form.delete('file');
    const ok = await run(() => apiUpload('/api/me/qualifications', form));
    if (ok) {
      setOpen(false);
      onChanged();
    }
  }

  return (
    <Card
      title="Qualifications"
      description="Degrees and diplomas. Attach the certificate so an admin can verify it."
      action={!open && <Button variant="secondary" onClick={() => setOpen(true)}>Add qualification</Button>}
    >
      {open && (
        <form onSubmit={onSubmit} className="mb-5 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
          <Field label="Degree">
            <Input name="degree" required maxLength={60} placeholder="e.g. M.Sc." />
          </Field>
          <Field label="Field of study">
            <Input name="fieldOfStudy" required maxLength={120} placeholder="e.g. Atmospheric Physics" />
          </Field>
          <Field label="Institution">
            <Input name="institution" required maxLength={150} />
          </Field>
          <Field label="Year completed">
            <Input name="yearCompleted" type="number" min={1950} max={2100} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Degree certificate (optional)" hint={FILE_HINT}>
              <Input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg" />
            </Field>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
        </form>
      )}

      {profile.qualifications.length === 0 ? (
        <EmptyState>No qualifications added yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {profile.qualifications.map((q) => (
            <li key={q.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">
                  {q.degree} {q.fieldOfStudy}
                </p>
                <p className="text-sm text-slate-600">
                  {q.institution}
                  {q.yearCompleted && ` · ${q.yearCompleted}`}
                </p>
                <div className="mt-1"><VerificationBadge status={q.status} /></div>
              </div>
              <div className="flex gap-2">
                {q.hasFile && (
                  <Button variant="secondary" onClick={() => openFile(`/api/documents/qualifications/${q.id}/file`)}>View</Button>
                )}
                {q.status !== 'VERIFIED' && (
                  <Button
                    variant="danger"
                    disabled={del.busy}
                    onClick={async () => (await del.run(() => api(`/api/me/qualifications/${q.id}`, { method: 'DELETE' }))) && onChanged()}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {del.error && <div className="mt-3"><Alert>{del.error}</Alert></div>}
    </Card>
  );
}

// ── Work experience ───────────────────────────────────────

export function ExperienceSection({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useSubmit();
  const del = useSubmit();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const ok = await run(() =>
      api('/api/me/experiences', {
        method: 'POST',
        body: { ...f, endDate: f.endDate || undefined, description: f.description || undefined },
      }),
    );
    if (ok) {
      setOpen(false);
      onChanged();
    }
  }

  return (
    <Card
      title="Work experience"
      action={!open && <Button variant="secondary" onClick={() => setOpen(true)}>Add experience</Button>}
    >
      {open && (
        <form onSubmit={onSubmit} className="mb-5 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
          <Field label="Organisation">
            <Input name="organisation" required maxLength={150} placeholder="e.g. IMD Pune" />
          </Field>
          <Field label="Role / title">
            <Input name="title" required maxLength={120} />
          </Field>
          <Field label="From">
            <Input name="startDate" type="date" required />
          </Field>
          <Field label="To" hint="Leave empty if this is your current role">
            <Input name="endDate" type="date" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="What you did (optional)">
              <Input name="description" maxLength={1000} />
            </Field>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
        </form>
      )}

      {profile.experiences.length === 0 ? (
        <EmptyState>No work experience added yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {profile.experiences.map((x) => (
            <li key={x.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">{x.title}</p>
                <p className="text-sm text-slate-600">
                  {x.organisation} · {formatDate(x.startDate)} – {x.endDate ? formatDate(x.endDate) : 'present'}
                </p>
                {x.description && <p className="mt-1 text-sm text-slate-500">{x.description}</p>}
              </div>
              <Button
                variant="danger"
                disabled={del.busy}
                onClick={async () => (await del.run(() => api(`/api/me/experiences/${x.id}`, { method: 'DELETE' }))) && onChanged()}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      {del.error && <div className="mt-3"><Alert>{del.error}</Alert></div>}
    </Card>
  );
}
