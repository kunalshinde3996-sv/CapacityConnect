import { open, readFile } from 'node:fs/promises';
import path from 'node:path';

// The only file types the app accepts. Each upload is checked three ways:
// extension, the MIME type the browser declared, and the file's first bytes
// ("magic number"), so a renamed .exe cannot pass as a .pdf.
export type FileKind = 'pdf' | 'mp4' | 'pptx' | 'docx' | 'png' | 'jpg';

interface FileTypeInfo {
  mime: string;
  extensions: string[];
  inline: boolean; // open in the browser (true) or download (false)
}

export const FILE_TYPES: Record<FileKind, FileTypeInfo> = {
  pdf: { mime: 'application/pdf', extensions: ['.pdf'], inline: true },
  mp4: { mime: 'video/mp4', extensions: ['.mp4'], inline: true },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extensions: ['.pptx'], inline: false },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['.docx'], inline: false },
  png: { mime: 'image/png', extensions: ['.png'], inline: true },
  jpg: { mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'], inline: true },
};

export function kindFromFilename(filename: string): FileKind | null {
  const ext = path.extname(filename).toLowerCase();
  const match = Object.entries(FILE_TYPES).find(([, info]) => info.extensions.includes(ext));
  return match ? (match[0] as FileKind) : null;
}

// Browsers sometimes send a generic type (or none) for Office files; those are allowed
// because the content check below still has to pass.
export function declaredMimeOk(kind: FileKind, declared: string) {
  return declared === FILE_TYPES[kind].mime || declared === 'application/octet-stream' || declared === '';
}

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

// Checks the real content of the file on disk.
export async function contentMatches(kind: FileKind, filePath: string): Promise<boolean> {
  const handle = await open(filePath, 'r');
  const head = Buffer.alloc(16);
  try {
    await handle.read(head, 0, 16, 0);
  } finally {
    await handle.close();
  }

  switch (kind) {
    case 'pdf':
      return head.subarray(0, 5).toString('latin1') === '%PDF-';
    case 'png':
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'jpg':
      return startsWith(head, [0xff, 0xd8, 0xff]);
    case 'mp4':
      // ISO media files have "ftyp" at byte 4
      return head.subarray(4, 8).toString('latin1') === 'ftyp';
    case 'docx':
    case 'pptx': {
      // Office files are zip archives; the folder names inside tell Word and PowerPoint apart.
      if (!startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return false;
      const whole = await readFile(filePath);
      return whole.includes(kind === 'docx' ? 'word/' : 'ppt/');
    }
  }
}

export function mimeForKey(key: string) {
  const kind = kindFromFilename(key);
  return kind ? FILE_TYPES[kind] : { mime: 'application/octet-stream', extensions: [], inline: false };
}
