'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, Field, formatDate, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import type { Profile } from '@/lib/profile';
import { useSubmit } from '@/lib/useSubmit';

// "Become a trainer": a trainee applies, an admin reviews. Approval changes the role.
export function ApplicationSection({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const latest = profile.trainerApplications[0];
  const [motivation, setMotivation] = useState('');
  const { busy, error, run } = useSubmit();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => api('/api/me/trainer-application', { method: 'POST', body: { motivation } }))) onChanged();
  }

  if (latest?.status === 'PENDING') {
    return (
      <Card title="Become a trainer">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Badge tone="amber">Under review</Badge>
          You applied on {formatDate(latest.createdAt)}. An admin will review your profile.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Become a trainer"
      description="Share your knowledge with colleagues across MoES. An admin reviews your profile, qualifications and experience."
    >
      {latest?.status === 'REJECTED' && (
        <div className="mb-4">
          <Alert tone="amber">
            Your previous application was not approved{latest.reviewNote ? `: ${latest.reviewNote}` : '.'} You can apply again.
          </Alert>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Why do you want to train others, and in what?" hint="At least 30 characters">
          <Textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} required minLength={30} maxLength={2000} rows={4} />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Apply to become a trainer'}</Button>
        {error && <Alert>{error}</Alert>}
      </form>
    </Card>
  );
}
