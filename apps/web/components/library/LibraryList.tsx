'use client';

import Link from 'next/link';
import { Badge, Button, EmptyState } from '@/components/ui';
import { openFile } from '@/lib/api';
import { fileSize, type LibraryItem, opensInBrowser, TYPE_ICONS, TYPE_LABELS } from '@/lib/library';

// Library items as cards. `actions` lets the trainer view add edit/delete buttons.
export function LibraryList({
  items,
  empty = 'Nothing here yet.',
  actions,
}: {
  items: LibraryItem[];
  empty?: string;
  actions?: (item: LibraryItem) => React.ReactNode;
}) {
  if (items.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg text-brand-700">
            {TYPE_ICONS[item.type]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link href={`/library/${item.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                {item.title}
              </Link>
              {!item.isPublished && <Badge tone="amber">Hidden</Badge>}
            </div>
            <p className="text-xs text-slate-500">
              {TYPE_LABELS[item.type]} · {fileSize(item.sizeBytes)} · {item.uploadedBy.fullName}
              {item.course && ` · ${item.course.title}`}
              {item.module && ` › ${item.module.title}`}
            </p>
            {item.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.description}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.competencies.map((c) => (
                <Badge key={c.competency.id} tone="brand">{c.competency.name}</Badge>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.type === 'VIDEO' ? (
                <Link href={`/library/${item.id}`} className="inline-flex min-h-8 items-center rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">
                  Watch
                </Link>
              ) : (
                <Button className="min-h-8 px-3" onClick={() => openFile(`/api/library/${item.id}/file`)}>
                  {opensInBrowser(item) ? 'Open' : 'Download'}
                </Button>
              )}
              {actions?.(item)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
