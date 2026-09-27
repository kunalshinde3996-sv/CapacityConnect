'use client';

import { useEffect, useState } from 'react';
import { LibraryList } from '@/components/library/LibraryList';
import { Alert, Button, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { type LibraryItem, type LibraryType, TYPE_LABELS } from '@/lib/library';
import type { Competency } from '@/lib/profile';

// Trainer library: every published lecture, slide deck and set of notes, searchable
// and filterable by competency and type.
export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ q: '', competencyId: '', type: '' });

  useEffect(() => {
    api<{ competencies: Competency[] }>('/api/competencies').then((d) => setCompetencies(d.competencies)).catch(() => {});
  }, []);

  useEffect(() => {
    let stale = false; // ignore an outdated response if filters changed meanwhile
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    api<{ items: LibraryItem[] }>(`/api/library?${params}`)
      .then((d) => !stale && setItems(d.items))
      .catch((err) => !stale && setError(err instanceof ApiError ? err.message : 'Could not load the library'));
    return () => {
      stale = true;
    };
  }, [filters]);

  return (
    <>
      <PageHeader title="Library" description="Lectures, slides and notes from MoES trainers, tagged with competencies." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...filters, q });
        }}
        className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <Input aria-label="Search the library" placeholder="Search by title or description" value={q} onChange={(e) => setQ(e.target.value)} className="mt-0" />
        <Select aria-label="Filter by competency" value={filters.competencyId} onChange={(e) => setFilters({ ...filters, competencyId: e.target.value })} className="mt-0">
          <option value="">All competencies</option>
          {competencies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select aria-label="Filter by type" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="mt-0">
          <option value="">All types</option>
          {(Object.keys(TYPE_LABELS) as LibraryType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <Button type="submit">Search</Button>
      </form>
      {error && <Alert>{error}</Alert>}
      {!items && !error && <Spinner />}
      {items && <LibraryList items={items} empty="No material matches these filters." />}
    </>
  );
}
