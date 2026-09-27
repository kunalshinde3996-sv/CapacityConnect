'use client';

import { useState } from 'react';
import { Alert, Button, Card, Field, Input, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import type { Profile } from '@/lib/profile';
import { useSubmit } from '@/lib/useSubmit';

export function DetailsSection({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const isTrainer = profile.role === 'TRAINER';
  const [form, setForm] = useState({
    fullName: profile.fullName,
    designation: profile.designation ?? '',
    phone: profile.phone ?? '',
    bio: (isTrainer ? profile.trainerProfile?.bio : profile.traineeProfile?.bio) ?? '',
    interests: profile.traineeProfile?.interests.join(', ') ?? '',
    headline: profile.trainerProfile?.headline ?? '',
    yearsOfExperience: profile.trainerProfile?.yearsOfExperience?.toString() ?? '',
  });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setForm({ ...form, [key]: e.target.value });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      api('/api/me/profile', {
        method: 'PATCH',
        body: {
          fullName: form.fullName,
          designation: form.designation,
          phone: form.phone,
          bio: form.bio,
          ...(isTrainer
            ? { headline: form.headline, yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined }
            : { interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean) }),
        },
      }),
    );
    if (ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <Card title="Personal details" description={`${profile.email} · ${profile.institute?.name ?? 'No institute'}`}>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input value={form.fullName} onChange={set('fullName')} required minLength={2} />
        </Field>
        <Field label="Designation">
          <Input value={form.designation} onChange={set('designation')} placeholder="e.g. Scientist-B" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} inputMode="tel" />
        </Field>
        {isTrainer ? (
          <>
            <Field label="Years of experience">
              <Input type="number" min={0} max={60} value={form.yearsOfExperience} onChange={set('yearsOfExperience')} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Headline" hint="One line shown on trainer rankings">
                <Input value={form.headline} onChange={set('headline')} maxLength={150} />
              </Field>
            </div>
          </>
        ) : (
          <Field label="Interests" hint="Comma-separated, e.g. monsoon forecasting, GIS">
            <Input value={form.interests} onChange={set('interests')} />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Field label="About you">
            <Textarea value={form.bio} onChange={set('bio')} maxLength={1000} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save details'}
          </Button>
          {saved && <span className="text-sm text-emerald-700">Saved</span>}
        </div>
        {error && (
          <div className="sm:col-span-2">
            <Alert>{error}</Alert>
          </div>
        )}
      </form>
    </Card>
  );
}
