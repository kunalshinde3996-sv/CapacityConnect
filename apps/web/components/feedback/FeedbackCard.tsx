'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Field, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { useSubmit } from '@/lib/useSubmit';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// A trainee rates the course (1-5 stars + optional comment). Can be changed later.
export function FeedbackCard({ courseId }: { courseId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState<number | null>(null);
  const { busy, error, run } = useSubmit();

  useEffect(() => {
    api<{ mine: { rating: number; comment: string | null } | null }>(`/api/courses/${courseId}/feedback`)
      .then(({ mine }) => {
        if (!mine) return;
        setRating(mine.rating);
        setComment(mine.comment ?? '');
        setSaved(mine.rating);
      })
      .catch(() => {});
  }, [courseId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => api(`/api/courses/${courseId}/feedback`, { method: 'PUT', body: { rating, comment: comment || undefined } }))) {
      setSaved(rating);
    }
  }

  return (
    <Card title="Rate this course" description="Anonymous to the trainer. Good ratings count as teaching evidence for them.">
      <form onSubmit={submit} className="space-y-3">
        <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}: ${LABELS[n]}`}
              onClick={() => {
                setRating(n);
                setSaved(null);
              }}
              className={`text-3xl leading-none transition-colors ${n <= rating ? 'text-amber-400' : 'text-slate-300 hover:text-amber-200'}`}
            >
              ★
            </button>
          ))}
          <span className="ml-2 text-sm text-slate-600">{LABELS[rating]}</span>
        </div>
        <Field label="Comment (optional)">
          <Textarea rows={2} maxLength={1000} value={comment} onChange={(e) => { setComment(e.target.value); setSaved(null); }} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || rating === 0}>{busy ? 'Saving…' : saved ? 'Update rating' : 'Submit rating'}</Button>
          {saved && <span className="text-sm text-emerald-700">Thanks, your rating is saved.</span>}
        </div>
        {error && <Alert>{error}</Alert>}
      </form>
    </Card>
  );
}
