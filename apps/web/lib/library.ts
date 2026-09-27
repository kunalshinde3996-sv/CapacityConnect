export type LibraryType = 'VIDEO' | 'SLIDES' | 'DOCUMENT';

export interface LibraryItem {
  id: string;
  title: string;
  description: string | null;
  type: LibraryType;
  mimeType: string | null;
  sizeBytes: number | null;
  isPublished: boolean;
  hasFile: boolean;
  createdAt: string;
  uploadedBy: { id: string; fullName: string; institute: { code: string } | null };
  course: { id: string; title: string } | null;
  module: { id: string; title: string; order: number } | null;
  competencies: { competency: { id: string; name: string } }[];
}

export const TYPE_LABELS: Record<LibraryType, string> = { VIDEO: 'Lecture video', SLIDES: 'Slides', DOCUMENT: 'Notes' };
export const TYPE_ICONS: Record<LibraryType, string> = { VIDEO: '▶', SLIDES: '▤', DOCUMENT: '✎' };
// What the file picker offers for each type (the API checks again, by content).
export const ACCEPT: Record<LibraryType, string> = { VIDEO: '.mp4', SLIDES: '.pdf,.pptx', DOCUMENT: '.pdf,.docx' };

export function fileSize(bytes: number | null) {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// PDFs and videos open in the browser; Office files download.
export const opensInBrowser = (item: Pick<LibraryItem, 'mimeType'>) =>
  item.mimeType === 'application/pdf' || item.mimeType === 'video/mp4';
