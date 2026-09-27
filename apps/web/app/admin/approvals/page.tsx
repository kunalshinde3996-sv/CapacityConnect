'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, PageHeader, Spinner, Toast } from '@/components/ui';
import { api, ApiError, type User } from '@/lib/api';

interface UserList {
  items: User[];
  total: number;
}

const fetchPending = () => api<UserList>('/api/users?status=PENDING&pageSize=100');

export default function ApprovalsPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);

  const showUsers = useCallback((data: UserList) => {
    setUsers(data.items);
    setLoadError(null);
  }, []);
  const showLoadError = useCallback((err: unknown) => {
    setLoadError(err instanceof ApiError ? err.message : 'Could not load pending users');
  }, []);

  useEffect(() => {
    fetchPending().then(showUsers).catch(showLoadError);
  }, [showUsers, showLoadError]);

  const load = () => fetchPending().then(showUsers).catch(showLoadError);

  // Hide the toast after 5 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function decide(user: User, action: 'approve' | 'reject', reason?: string) {
    setNotice(null);
    try {
      await api(`/api/users/${user.id}/${action}`, { method: 'POST', body: reason ? { reason } : {} });
      setUsers((list) => list?.filter((u) => u.id !== user.id) ?? null);
      setNotice({
        tone: 'green',
        text: action === 'approve' ? `${user.fullName} approved and can now sign in.` : `${user.fullName}'s registration was rejected.`,
      });
    } catch (err) {
      setNotice({ tone: 'red', text: err instanceof ApiError ? err.message : 'Something went wrong' });
      // Someone else may have acted on this user: reload to show the truth.
      if (err instanceof ApiError && err.status === 409) load();
    }
  }

  return (
    <>
      <PageHeader title="Pending approvals" description="New registrations cannot sign in until an admin approves them.">
        {users && <Badge tone={users.length ? 'amber' : 'green'}>{users.length} waiting</Badge>}
      </PageHeader>

      {notice && (
        <Toast tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Toast>
      )}

      <div className="space-y-4">
        {loadError && <Alert>{loadError}</Alert>}
        {!users && !loadError && <Spinner />}

        {users?.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
            No pending registrations. You are all caught up.
          </div>
        )}

        <ul className="space-y-3">
          {users?.map((user) => (
            <PendingUserCard key={user.id} user={user} onDecide={decide} />
          ))}
        </ul>
      </div>
    </>
  );
}

function PendingUserCard({
  user,
  onDecide,
}: {
  user: User;
  onDecide: (user: User, action: 'approve' | 'reject', reason?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  async function run(action: 'approve' | 'reject') {
    setBusy(true);
    await onDecide(user, action, action === 'reject' ? reason.trim() || undefined : undefined);
    setBusy(false);
  }

  return (
    <li className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{user.fullName}</p>
          <p className="truncate text-sm text-slate-600">{user.email}</p>
          <p className="mt-2 text-sm text-slate-600">
            {[user.designation, user.institute?.name].filter(Boolean).join(' · ') || 'No institute given'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Registered {new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        {!rejecting && (
          <div className="flex gap-2 sm:shrink-0">
            <Button onClick={() => run('approve')} disabled={busy} className="flex-1 sm:flex-none">
              Approve
            </Button>
            <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy} className="flex-1 sm:flex-none">
              Reject
            </Button>
          </div>
        )}
      </div>

      {rejecting && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <label htmlFor={`reason-${user.id}`} className="block text-sm font-medium text-slate-700">
            Reason (optional, saved in the audit log)
          </label>
          <textarea
            id={`reason-${user.id}`}
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="block w-full rounded-lg border-0 px-3 py-2 text-base ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600 sm:text-sm"
          />
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => run('reject')} disabled={busy} className="flex-1 sm:flex-none">
              Confirm reject
            </Button>
            <Button variant="secondary" onClick={() => setRejecting(false)} disabled={busy} className="flex-1 sm:flex-none">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
