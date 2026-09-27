'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, LEVEL_NAMES, Select } from '@/components/ui';
import { api } from '@/lib/api';
import type { Competency, Profile } from '@/lib/profile';
import { useSubmit } from '@/lib/useSubmit';

const CATEGORY_LABELS = { DOMAIN: 'Domain', FUNCTIONAL: 'Functional', BEHAVIOURAL: 'Behavioural' } as const;

// Skills are picked from the shared competency framework (no free text), so they can
// feed the organisation's skill-gap view. Levels measured by an assessment are locked.
export function SkillsSection({ profile, competencies, onSaved }: { profile: Profile; competencies: Competency[]; onSaved: () => void }) {
  const measured = profile.userCompetencies.filter((s) => s.source !== 'SELF_ASSESSED');
  const [skills, setSkills] = useState(
    profile.userCompetencies.filter((s) => s.source === 'SELF_ASSESSED').map((s) => ({ competencyId: s.competency.id, level: s.level })),
  );
  const [pick, setPick] = useState('');
  const { busy, error, run } = useSubmit();
  const [saved, setSaved] = useState(false);

  const taken = new Set([...skills.map((s) => s.competencyId), ...measured.map((m) => m.competency.id)]);
  const name = (id: string) => competencies.find((c) => c.id === id)?.name ?? 'Unknown';

  function add() {
    if (!pick) return;
    setSkills([...skills, { competencyId: pick, level: 1 }]);
    setPick('');
    setSaved(false);
  }

  async function save() {
    const ok = await run(() => api('/api/me/skills', { method: 'PUT', body: { skills } }));
    if (ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <Card title="Skills" description="Pick competencies from the MoES framework and rate yourself honestly. Assessments update these levels.">
      {measured.length > 0 && (
        <ul className="mb-4 space-y-2">
          {measured.map((m) => (
            <li key={m.competency.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium">{m.competency.name}</span>
              <span className="flex items-center gap-2">
                <span>
                  L{m.level} {LEVEL_NAMES[m.level]}
                </span>
                <Badge tone="green">Measured by assessment</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}

      {skills.length === 0 && measured.length === 0 && <EmptyState>No skills yet. Add your first one below.</EmptyState>}

      <ul className="space-y-2">
        {skills.map((s, i) => (
          <li key={s.competencyId} className="flex flex-col gap-2 rounded-lg ring-1 ring-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">{name(s.competencyId)}</span>
            <div className="flex items-center gap-2">
              <Select
                aria-label={`Level for ${name(s.competencyId)}`}
                value={s.level}
                onChange={(e) => {
                  setSaved(false);
                  setSkills(skills.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)));
                }}
                className="mt-0 sm:w-44"
              >
                {[1, 2, 3, 4].map((l) => (
                  <option key={l} value={l}>
                    L{l} {LEVEL_NAMES[l]}
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                className="shrink-0"
                aria-label={`Remove ${name(s.competencyId)}`}
                onClick={() => {
                  setSaved(false);
                  setSkills(skills.filter((_, j) => j !== i));
                }}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Select aria-label="Add a competency" value={pick} onChange={(e) => setPick(e.target.value)} className="mt-0">
          <option value="">Add a competency…</option>
          {(['DOMAIN', 'FUNCTIONAL', 'BEHAVIOURAL'] as const).map((cat) => (
            <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
              {competencies
                .filter((c) => c.category === cat && !taken.has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
        <Button variant="secondary" onClick={add} disabled={!pick} className="shrink-0">
          Add
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save skills'}
        </Button>
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </Card>
  );
}
