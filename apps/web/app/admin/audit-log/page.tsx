'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, PageHeader, Select, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/assessments';

interface Entry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { fullName: string; role: string } | null;
}

interface Page {
  items: Entry[];
  total: number;
  page: number;
  pageSize: number;
  actions: { action: string; count: number }[];
}

const label = (action: string) => action.toLowerCase().replaceAll('_', ' ');

// Read-only audit trail: approvals, role changes, verifications and other key actions.
export default function AuditLogPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    const params = new URLSearchParams({ page: String(page), ...(action && { action }) });
    api<Page>(`/api/audit-log?${params}`)
      .then((d) => !stale && setData(d))
      .catch((err) => !stale && setError(err instanceof ApiError ? err.message : 'Could not load the audit log'));
    return () => {
      stale = true;
    };
  }, [action, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Audit log" description="Who did what, and when. Entries cannot be edited or deleted.">
        <Select
          aria-label="Filter by action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="mt-0 w-auto"
        >
          <option value="">All actions</option>
          {data?.actions.map((a) => (
            <option key={a.action} value={a.action}>{label(a.action)} ({a.count})</option>
          ))}
        </Select>
      </PageHeader>
      {error && <Alert>{error}</Alert>}
      {!data && !error && <Spinner />}

      {data && (
        <Card title={`${data.total} entries`}>
          <ol className="divide-y divide-slate-100">
            {data.items.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p>
                    <span className="font-medium text-slate-900">{e.actor?.fullName ?? 'System'}</span>{' '}
                    <span className="text-slate-700">{label(e.action)}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    {e.entityType} {e.entityId}
                  </p>
                  {e.metadata && (
                    <p className="mt-1 break-words font-mono text-xs text-slate-600">
                      {Object.entries(e.metadata).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {e.actor && <Badge>{e.actor.role.toLowerCase()}</Badge>}
                  <time className="text-xs text-slate-600" dateTime={e.createdAt}>{formatDateTime(e.createdAt)}</time>
                </div>
              </li>
            ))}
          </ol>
          <nav className="mt-4 flex items-center justify-between gap-2" aria-label="Audit log pages">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</Button>
            <span className="text-sm text-slate-600">Page {page} of {pages}</span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older</Button>
          </nav>
        </Card>
      )}
    </>
  );
}
