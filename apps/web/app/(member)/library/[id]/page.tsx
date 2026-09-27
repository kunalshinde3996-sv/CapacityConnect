'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, formatDate, Spinner } from '@/components/ui';
import { api, ApiError, fileUrl, openFile } from '@/lib/api';
import { fileSize, type LibraryItem, opensInBrowser, TYPE_LABELS } from '@/lib/library';

export default function LibraryItemPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ item: LibraryItem }>(`/api/library/${id}`)
      .then(async ({ item }) => {
        setItem(item);
        // Videos play in a normal HTML5 player from a signed link (valid 2 hours).
        if (item.type === 'VIDEO') setVideoSrc(await fileUrl(`/api/library/${id}/file`));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this item'));
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!item) return <Spinner />;

  return (
    <>
      <Link href="/library" className="text-sm font-medium text-brand-600 hover:underline">
        ← Library
      </Link>
      <div className="mt-3 mb-5">
        <h1 className="text-2xl font-bold text-slate-900">{item.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {TYPE_LABELS[item.type]} · {item.uploadedBy.fullName}
          {item.uploadedBy.institute && ` (${item.uploadedBy.institute.code})`} · {formatDate(item.createdAt)} · {fileSize(item.sizeBytes)}
        </p>
      </div>

      {item.type === 'VIDEO' && (
        <div className="mb-5 overflow-hidden rounded-xl bg-black shadow-sm">
          {videoSrc ? (
            // playsInline: plays inside the page on iPhones instead of forcing full screen
            <video controls playsInline preload="metadata" src={videoSrc} className="aspect-video w-full">
              Your browser cannot play this video.
            </video>
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-slate-300">Loading video…</div>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card title="About">
          {item.description ? <p className="text-sm text-slate-700">{item.description}</p> : <p className="text-sm text-slate-500">No description.</p>}
          {item.type !== 'VIDEO' && (
            <Button className="mt-4" onClick={() => openFile(`/api/library/${item.id}/file`)}>
              {opensInBrowser(item) ? 'Open file' : 'Download file'}
            </Button>
          )}
          {item.course && (
            <p className="mt-4 text-sm text-slate-600">
              Part of{' '}
              <Link href={`/courses/${item.course.id}`} className="font-medium text-brand-700 underline hover:no-underline">
                {item.course.title}
              </Link>
              {item.module && ` › ${item.module.title}`}
            </p>
          )}
        </Card>
        <Card title="Competencies">
          <div className="flex flex-wrap gap-1.5">
            {item.competencies.map((c) => (
              <Badge key={c.competency.id} tone="brand">{c.competency.name}</Badge>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
