'use client';

import { useState } from 'react';
import { Button, Field, Textarea } from '@/components/ui';

// Approve / Reject buttons with an inline "reason" box for rejections.
// Used by every admin review queue (users, claims, documents, applications).
export function ReviewActions({
  onDecide,
  approveLabel = 'Approve',
}: {
  onDecide: (decision: 'APPROVE' | 'REJECT', reason?: string) => Promise<void>;
  approveLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  async function decide(decision: 'APPROVE' | 'REJECT') {
    setBusy(true);
    await onDecide(decision, decision === 'REJECT' ? reason.trim() : undefined);
    setBusy(false);
  }

  if (rejecting) {
    return (
      <div className="w-full space-y-3 border-t border-slate-100 pt-3">
        <Field label="Reason (shown to the user and saved in the audit log)">
          <Textarea rows={2} minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button variant="danger" disabled={busy || reason.trim().length < 5} onClick={() => decide('REJECT')} className="flex-1 sm:flex-none">
            Confirm reject
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setRejecting(false)} className="flex-1 sm:flex-none">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 sm:shrink-0">
      <Button disabled={busy} onClick={() => decide('APPROVE')} className="flex-1 sm:flex-none">
        {approveLabel}
      </Button>
      <Button variant="danger" disabled={busy} onClick={() => setRejecting(true)} className="flex-1 sm:flex-none">
        Reject
      </Button>
    </div>
  );
}
