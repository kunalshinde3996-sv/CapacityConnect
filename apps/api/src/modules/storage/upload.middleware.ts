import { unlink } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { contentMatches, declaredMimeOk, FILE_TYPES, type FileKind, kindFromFilename } from './fileTypes.js';
import { newFileKey, storage } from './storage.service.js';

// A checked upload waiting in the temp folder. Services call storeUpload() to keep it.
export interface Upload {
  tempPath: string;
  kind: FileKind;
  originalName: string;
  sizeBytes: number;
}

// multer writes the file to the OS temp folder and enforces the size limit while
// streaming, so an oversized upload is cut off early instead of filling the disk.
const parser = multer({
  storage: multer.diskStorage({}),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 30 },
});

/**
 * Accepts one file in the multipart field `field` (plus normal text fields in req.body).
 * Rejects anything that is not one of `allowed`, by extension, declared type AND content.
 */
export function acceptUpload(field: string, allowed: FileKind[], opts: { required: boolean }): RequestHandler[] {
  const check: RequestHandler = async (req, res, next) => {
    const file = req.file;
    if (!file) {
      return next(opts.required ? AppError.badRequest(`A file is required (field "${field}")`) : undefined);
    }
    // The temp file is removed once the response is sent, whatever happened.
    res.on('close', () => void unlink(file.path).catch(() => {}));

    const kind = kindFromFilename(file.originalname);
    const allowedList = allowed.map((k) => FILE_TYPES[k].extensions[0]).join(', ');
    if (!kind || !allowed.includes(kind) || !declaredMimeOk(kind, file.mimetype)) {
      return next(new AppError(415, 'UNSUPPORTED_FILE_TYPE', `Only these file types are allowed here: ${allowedList}`));
    }
    if (!(await contentMatches(kind, file.path))) {
      return next(new AppError(415, 'UNSUPPORTED_FILE_TYPE', `The file content does not look like a real ${kind.toUpperCase()} file`));
    }

    req.upload = { tempPath: file.path, kind, originalName: path.basename(file.originalname), sizeBytes: file.size };
    next();
  };
  return [parser.single(field), check];
}

// Moves a checked upload into permanent storage and returns what to save in the database.
export async function storeUpload(upload: Upload, category: Parameters<typeof newFileKey>[0]) {
  const key = newFileKey(category, FILE_TYPES[upload.kind].extensions[0]!);
  await storage.save(upload.tempPath, key);
  return { fileKey: key, mimeType: FILE_TYPES[upload.kind].mime, sizeBytes: upload.sizeBytes };
}
